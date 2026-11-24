import { Resend } from 'resend';
import * as logger from 'firebase-functions/logger';
import { APP_BASE_URL, APP_ENV, isProduction } from '../config';
import { OUTCOME_EMAIL_FROM } from '../pipeline/outcomeEmail';
import {
  normalizePrice,
  parseIssueDate,
  pctChange,
  PriceRecord,
  quarterlyAverages,
} from './aggregate';
import { seasonalIndex } from './seasonal';

const GRAMS_PER_KG = 1000;
const DEFAULT_DIP_THRESHOLD_PCT = 3;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export interface CompositionItem {
  commodityKey: string;
  ratio: number;
}

export interface MaterialSpec {
  id?: string;
  name: string;
  companyName: string;
  composition: CompositionItem[];
}

export interface BuyWindowOpportunity {
  companyName: string;
  materialName: string;
  currentCost: number;
  priorQuarterCost: number | null;
  quarterDeltaPct: number | null;
  nextMonthLabel: string;
  nextMonthSeasonalPct: number | null;
  reasons: string[];
}

export interface EvaluateBuyWindowsOptions {
  dipThresholdPct?: number;
  now?: Date;
}

export interface SendGuidanceAlertOptions {
  to: string;
  opportunities: BuyWindowOpportunity[];
  baseUrl?: string;
}

/**
 * Checks whether a commodity key is safe to use as an object property key.
 * @param {string} key Candidate commodity key.
 * @returns {boolean} True when non-empty and not a prototype property.
 */
function isSafeKey(key: string): boolean {
  return Boolean(key) && !UNSAFE_KEYS.has(key);
}

/**
 * Clamps a composition ratio to a finite non-negative number.
 * @param {number} ratio Raw grams-per-kg ratio.
 * @returns {number} Non-negative finite ratio.
 */
function clampRatio(ratio: number): number {
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 0;
}

/**
 * Computes the SM-61 blended material cost per kg of finished product:
 * Σ(grams × price) ÷ 1000, with priced-average imputation when some
 * recipe commodities lack a price in the given record.
 * @param {CompositionItem[]} comp Material composition (grams per kg).
 * @param {Record<string, unknown> | null} record Price record or null.
 * @returns {number | null} Blended cost in Rs/kg, or null if unpriced.
 */
export function computeBlendedCost(
  comp: CompositionItem[],
  record: Record<string, unknown> | null
): number | null {
  if (!record || comp.length === 0) return null;
  let weighted = 0;
  let pricedGrams = 0;
  let recipeGrams = 0;
  for (const item of comp) {
    const g = clampRatio(item.ratio);
    recipeGrams += g;
    if (g <= 0 || !isSafeKey(item.commodityKey)) continue;
    if (!Object.prototype.hasOwnProperty.call(record, item.commodityKey)) {
      continue;
    }
    const price = normalizePrice(record[item.commodityKey]);
    if (price === null) continue;
    weighted += g * price;
    pricedGrams += g;
  }
  if (pricedGrams <= 0) return null;
  return ((weighted / pricedGrams) * recipeGrams) / GRAMS_PER_KG;
}

/**
 * Picks the most recent PriceRecord chronologically by dd/MM/yyyy.
 * @param {PriceRecord[]} records Historical price records.
 * @returns {PriceRecord | null} Latest record, or null if none valid.
 */
function findLatestRecord(records: PriceRecord[]): PriceRecord | null {
  let best: PriceRecord | null = null;
  let bestKey = -1;
  for (const rec of records) {
    if (typeof rec.date !== 'string') continue;
    const parsed = parseIssueDate(rec.date);
    if (!parsed) continue;
    const day = parseInt(rec.date.split('/')[0], 10);
    const key =
      parsed.year * 10000 +
      parsed.month * 100 +
      (Number.isFinite(day) ? day : 0);
    if (key > bestKey) {
      bestKey = key;
      best = rec;
    }
  }
  return best;
}

/**
 * Computes the blended cost per calendar quarter for a material.
 * @param {CompositionItem[]} comp Material composition.
 * @param {PriceRecord[]} records Historical price records.
 * @param {Map<string, Map<string, number>>} qCache Quarterly average cache.
 * @returns {Map<string, number>} Sorted quarter keys to blended cost.
 */
function buildQuarterlyCostSeries(
  comp: CompositionItem[],
  records: PriceRecord[],
  qCache: Map<string, Map<string, number>>
): Map<string, number> {
  const periods = new Set<string>();
  for (const item of comp) {
    if (!isSafeKey(item.commodityKey)) continue;
    let qMap = qCache.get(item.commodityKey);
    if (!qMap) {
      qMap = quarterlyAverages(records, item.commodityKey);
      qCache.set(item.commodityKey, qMap);
    }
    for (const qKey of qMap.keys()) {
      periods.add(qKey);
    }
  }
  const out = new Map<string, number>();
  for (const period of [...periods].sort()) {
    const synthetic = Object.create(null) as Record<string, unknown>;
    for (const item of comp) {
      if (!isSafeKey(item.commodityKey)) continue;
      const val = qCache.get(item.commodityKey)?.get(period);
      if (val !== undefined) synthetic[item.commodityKey] = val;
    }
    const cost = computeBlendedCost(comp, synthetic);
    if (cost !== null) out.set(period, cost);
  }
  return out;
}

/**
 * Computes the cost-weighted seasonal index for a target calendar month.
 * @param {CompositionItem[]} comp Material composition.
 * @param {PriceRecord[]} records Historical price records.
 * @param {PriceRecord | null} latest Latest price record for cost shares.
 * @param {number} month Target calendar month (1-12).
 * @param {Map<string, Map<number, number>>} sCache Seasonal index cache.
 * @returns {number | null} Weighted seasonal MoM % or null if unavailable.
 */
function computeNextMonthSeasonalPct(
  comp: CompositionItem[],
  records: PriceRecord[],
  latest: PriceRecord | null,
  month: number,
  sCache: Map<string, Map<number, number>>
): number | null {
  if (!latest) return null;
  let totalCost = 0;
  const itemCosts: { key: string; cost: number }[] = [];
  for (const item of comp) {
    const g = clampRatio(item.ratio);
    if (g <= 0 || !isSafeKey(item.commodityKey)) continue;
    if (!Object.prototype.hasOwnProperty.call(latest, item.commodityKey)) {
      continue;
    }
    const price = normalizePrice(latest[item.commodityKey]);
    if (price === null) continue;
    const cost = g * price;
    itemCosts.push({ key: item.commodityKey, cost });
    totalCost += cost;
  }
  if (totalCost <= 0) return null;

  let weightedPct = 0;
  let hasSignal = false;
  for (const entry of itemCosts) {
    const share = entry.cost / totalCost;
    if (share <= 0) continue;
    let sMap = sCache.get(entry.key);
    if (!sMap) {
      sMap = seasonalIndex(records, entry.key);
      sCache.set(entry.key, sMap);
    }
    const mPct = sMap.get(month);
    if (mPct === undefined) continue;
    weightedPct += mPct * share;
    hasSignal = true;
  }
  return hasSignal ? weightedPct : null;
}

/**
 * Evaluates materials for weekly purchasing-guidance buy-window signals:
 * quarterly blended cost drop vs prior quarter, and upcoming calendar month
 * cost-weighted seasonal dip. Returns triggered opportunities sorted by the
 * strongest negative signal first.
 * @param {MaterialSpec[]} materials Candidate materials to evaluate.
 * @param {PriceRecord[]} records Historical price records.
 * @param {EvaluateBuyWindowsOptions} [options] Threshold & reference date.
 * @returns {BuyWindowOpportunity[]} Triggered opportunities, strongest first.
 */
export function evaluateBuyWindows(
  materials: MaterialSpec[],
  records: PriceRecord[],
  options?: EvaluateBuyWindowsOptions
): BuyWindowOpportunity[] {
  const rawThresh = options?.dipThresholdPct;
  const threshold =
    typeof rawThresh === 'number' &&
    Number.isFinite(rawThresh) &&
    rawThresh > 0
      ? rawThresh
      : DEFAULT_DIP_THRESHOLD_PCT;

  const now = options?.now ?? new Date();
  const curMonth = now.getUTCMonth() + 1;
  const nextMonth = curMonth === 12 ? 1 : curMonth + 1;
  const nextMonthLabel = MONTH_LABELS[nextMonth - 1];

  const validRecords = records.filter(
    (r): r is PriceRecord => Boolean(r) && typeof r.date === 'string'
  );
  const latest = findLatestRecord(validRecords);
  const qCache = new Map<string, Map<string, number>>();
  const sCache = new Map<string, Map<number, number>>();
  const opportunities: BuyWindowOpportunity[] = [];

  for (const mat of materials) {
    const qSeries = buildQuarterlyCostSeries(
      mat.composition,
      validRecords,
      qCache
    );
    const qKeys = [...qSeries.keys()].sort();
    if (qKeys.length === 0) continue;

    const currentCost = qSeries.get(qKeys[qKeys.length - 1])!;
    const priorQuarterCost =
      qKeys.length >= 2 ? qSeries.get(qKeys[qKeys.length - 2])! : null;
    const quarterDeltaPct = pctChange(priorQuarterCost, currentCost);

    const nextMonthSeasonalPct = computeNextMonthSeasonalPct(
      mat.composition,
      validRecords,
      latest,
      nextMonth,
      sCache
    );

    const reasons: string[] = [];
    if (quarterDeltaPct !== null && quarterDeltaPct <= -threshold) {
      const absStr = Math.abs(quarterDeltaPct).toFixed(1);
      reasons.push(`Cost down ${absStr}% vs prior quarter`);
    }
    if (nextMonthSeasonalPct !== null && nextMonthSeasonalPct <= -threshold) {
      const pctStr = nextMonthSeasonalPct.toFixed(1);
      reasons.push(`Seasonal dip in ${nextMonthLabel} (${pctStr}%)`);
    }

    if (reasons.length === 0) continue;

    opportunities.push({
      companyName: mat.companyName,
      materialName: mat.name,
      currentCost,
      priorQuarterCost,
      quarterDeltaPct,
      nextMonthLabel,
      nextMonthSeasonalPct,
      reasons,
    });
  }

  return opportunities.sort((a, b) => {
    const scoreA = Math.min(
      a.quarterDeltaPct ?? 0,
      a.nextMonthSeasonalPct ?? 0
    );
    const scoreB = Math.min(
      b.quarterDeltaPct ?? 0,
      b.nextMonthSeasonalPct ?? 0
    );
    return scoreA - scoreB;
  });
}

/**
 * Resolves the target email recipient for guidance alerts, honoring SM-66
 * non-production isolation (always routes to crnarendran@gmail.com outside
 * production so dev and staging never email real users).
 * @param {string | null} [prefEmail] User-configured contact email.
 * @param {string | null} [fallbackEmail] Fallback owner email.
 * @param {string} [env] Target environment (defaults to APP_ENV).
 * @returns {string | null} Normalized recipient email, or null if invalid.
 */
export function resolveGuidanceAlertRecipient(
  prefEmail?: string | null,
  fallbackEmail?: string | null,
  env: string = APP_ENV
): string | null {
  if (!isProduction(env)) {
    return 'crnarendran@gmail.com';
  }
  const chosen = prefEmail?.trim() || fallbackEmail?.trim() || '';
  const raw = chosen.toLowerCase();
  if (!raw || !EMAIL_RE.test(raw) || raw.endsWith('.gserviceaccount.com')) {
    return null;
  }
  return raw;
}

/**
 * Escapes HTML special characters to prevent XSS in generated emails.
 * @param {string} s Input string to escape.
 * @returns {string} HTML-safe escaped string.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Normalizes and validates the Guidance page link URL.
 * @param {string} baseUrl Base application origin URL.
 * @returns {string} Safe guidance page URL.
 */
function buildGuidanceUrl(baseUrl: string): string {
  const tryParse = (candidate: string): URL | null => {
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  };
  const parsed = tryParse(baseUrl) ?? tryParse(APP_BASE_URL);
  if (!parsed) return '#reports/guidance';
  const cleanPath = parsed.pathname.replace(/\/+$/, '');
  return `${parsed.origin}${cleanPath}/#reports/guidance`;
}

/**
 * Formats a signed percentage for HTML table display.
 * @param {number | null} pct Percentage value or null.
 * @returns {string} Formatted percentage string or em-dash.
 */
function formatSignedPct(pct: number | null): string {
  if (pct === null) return '—';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

/**
 * Builds an XSS-safe HTML email digest summarizing buy-window opportunities.
 * @param {BuyWindowOpportunity[]} opportunities Triggered opportunities.
 * @param {string} [baseUrl] Dashboard base URL (defaults to APP_BASE_URL).
 * @returns {string} Complete HTML email body.
 */
export function buildGuidanceAlertHtml(
  opportunities: BuyWindowOpportunity[],
  baseUrl: string = APP_BASE_URL
): string {
  const guidanceUrl = escapeHtml(buildGuidanceUrl(baseUrl));
  const rows = opportunities
    .map((opp) => {
      const company = escapeHtml(opp.companyName);
      const material = escapeHtml(opp.materialName);
      const costStr = `₹${opp.currentCost.toFixed(2)}/kg`;
      const qDeltaStr = formatSignedPct(opp.quarterDeltaPct);
      const monthLabel = escapeHtml(opp.nextMonthLabel);
      const sDeltaStr = formatSignedPct(opp.nextMonthSeasonalPct);
      const reasonsStr = opp.reasons.map((r) => escapeHtml(r)).join('; ');
      return (
        '<tr>' +
        '<td style="padding:8px 10px;border-bottom:1px solid #e5e7eb">' +
        `${company}</td>` +
        '<td style="padding:8px 10px;border-bottom:1px solid #e5e7eb">' +
        `<b>${material}</b></td>` +
        '<td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;' +
        `text-align:right;font-family:monospace">${costStr}</td>` +
        '<td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;' +
        `text-align:right;font-family:monospace">${qDeltaStr}</td>` +
        '<td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;' +
        `text-align:right;font-family:monospace">${monthLabel}: ` +
        `${sDeltaStr}</td>` +
        '<td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;' +
        `color:#166534">${reasonsStr}</td>` +
        '</tr>'
      );
    })
    .join('');

  return (
    '<div style="font-family:system-ui,-apple-system,sans-serif;' +
    'max-width:680px;color:#1f2937;line-height:1.5">' +
    '<h2 style="color:#111827;margin-bottom:8px">' +
    'Weekly Purchasing Guidance Alerts</h2>' +
    '<p style="margin:0 0 16px;color:#4b5563">' +
    'The following materials show a potential buying window based on ' +
    'quarterly blended cost moves and seasonal price patterns:</p>' +
    '<table style="width:100%;border-collapse:collapse;font-size:13px;' +
    'margin-bottom:20px">' +
    '<thead>' +
    '<tr style="background:#f3f4f6;text-align:left">' +
    '<th style="padding:8px 10px;border-bottom:2px solid #e5e7eb">' +
    'Company</th>' +
    '<th style="padding:8px 10px;border-bottom:2px solid #e5e7eb">' +
    'Material</th>' +
    '<th style="padding:8px 10px;border-bottom:2px solid #e5e7eb;' +
    'text-align:right">Current Cost</th>' +
    '<th style="padding:8px 10px;border-bottom:2px solid #e5e7eb;' +
    'text-align:right">vs Prior Qtr</th>' +
    '<th style="padding:8px 10px;border-bottom:2px solid #e5e7eb;' +
    'text-align:right">Next Month</th>' +
    '<th style="padding:8px 10px;border-bottom:2px solid #e5e7eb">' +
    'Signals</th>' +
    '</tr>' +
    '</thead>' +
    `<tbody>${rows}</tbody>` +
    '</table>' +
    `<a href="${guidanceUrl}" style="display:inline-block;background:#2563eb;` +
    'color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none;' +
    'font-weight:bold">Open Purchasing Guidance</a>' +
    '<p style="color:#9ca3af;font-size:12px;margin-top:24px">' +
    'Automated weekly digest from Shuddhi-Moolam. Manage preferences in ' +
    'Settings.</p>' +
    '</div>'
  );
}

/**
 * Sends a consolidated weekly guidance alert email via Resend.
 * Degrades gracefully if RESEND_API_KEY is missing, opportunities is empty,
 * or Resend fails.
 * @param {SendGuidanceAlertOptions} opts Recipient, opportunities, baseUrl.
 * @returns {Promise<boolean>} True if accepted by Resend, false otherwise.
 */
export async function sendGuidanceAlertEmail(
  opts: SendGuidanceAlertOptions
): Promise<boolean> {
  if (!opts.opportunities || opts.opportunities.length === 0) {
    logger.warn('No guidance opportunities provided — skipping alert email.');
    return false;
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    logger.warn('RESEND_API_KEY not set — skipping guidance alert email.');
    return false;
  }
  const to = opts.to.trim();
  if (!to) {
    logger.warn('Recipient email missing — skipping guidance alert email.');
    return false;
  }

  const count = opts.opportunities.length;
  const noun = count === 1 ? 'material' : 'materials';
  const subject =
    `Shuddhi-Moolam: Buy window alert for ${count} ${noun}`;
  const html = buildGuidanceAlertHtml(opts.opportunities, opts.baseUrl);

  try {
    const resend = new Resend(key);
    const { error } = await resend.emails.send({
      from: OUTCOME_EMAIL_FROM,
      to,
      subject,
      html,
    });
    if (error) {
      logger.error('Resend guidance alert email failed', { error });
      return false;
    }
    return true;
  } catch (e: unknown) {
    logger.error('Resend threw sending guidance alert email', {
      error: e instanceof Error ? e.message : String(e),
    });
    return false;
  }
}
