import { Resend } from 'resend';
import * as logger from 'firebase-functions/logger';
import { COMPONENTS } from '../gemini/components';
import { APP_BASE_URL, MASTER_SHEET_ID } from '../config';
import { type Outlier } from '../reporting/outliers';

export const FOUNDER_EMAILS = [
  'crnarendran@gmail.com',
  'mvsaikishore@gmail.com',
];

export const OUTCOME_EMAIL_FROM =
  'Shuddhi-Moolam <sai-shuddhi-moolam-no-reply@narensportal.com>';

export interface PipelineSuccessEmailOptions {
  filename: string;
  fileId: string;
  record: Record<string, unknown> & { date: string };
  tabTitle: string;
  action: 'APPEND' | 'UPDATE' | 'MANUAL_OVERRIDE_KEPT';
  durationMs?: number;
  tokensIn?: number;
  tokensOut?: number;
  totalTokens?: number;
  estCostUsd?: number;
  qualityOutliers?: Outlier[];
  autoVsManualDiffs?: { key: string; auto: string; manual: string }[];
  uploaderEmail?: string;
}

export interface PipelineFailureEmailOptions {
  fileId: string;
  filename?: string;
  failingStage: string;
  errorMessage: string;
  timestamp: number;
  uploaderEmail?: string;
}

/**
 * Resolves deduplicated, lowercased recipients for pipeline outcome
 * notifications. Ignores automated service account emails.
 * @param {string} [uploaderEmail] Optional uploader email from Drive.
 * @returns {string[]} Deduplicated list of recipient email addresses.
 */
export function resolveOutcomeRecipients(uploaderEmail?: string): string[] {
  const set = new Set<string>();
  if (uploaderEmail) {
    const clean = uploaderEmail.trim().toLowerCase();
    if (clean && !clean.endsWith('.gserviceaccount.com')) {
      set.add(clean);
    }
  }
  for (const founder of FOUNDER_EMAILS) {
    set.add(founder.toLowerCase());
  }
  return Array.from(set);
}

/**
 * Sends an email notification upon successful pipeline processing (SM-62).
 * Degrades gracefully if RESEND_API_KEY is unset or sending fails.
 * @param {PipelineSuccessEmailOptions} opts Success email parameters.
 * @returns {Promise<boolean>} True if accepted by Resend, false otherwise.
 */
export async function sendPipelineSuccessEmail(
  opts: PipelineSuccessEmailOptions
): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    logger.warn('RESEND_API_KEY not set — skipping pipeline success email.');
    return false;
  }

  const recipients = resolveOutcomeRecipients(opts.uploaderEmail);
  const subject =
    `Shuddhi-Moolam: Processed ${opts.filename} ` +
    `(Issue ${opts.record.date})`;

  const durationSec =
    typeof opts.durationMs === 'number'
      ? `${(opts.durationMs / 1000).toFixed(1)}s`
      : '—';
  const costStr =
    typeof opts.estCostUsd === 'number'
      ? `$${opts.estCostUsd.toFixed(4)}`
      : '—';
  const tokensStr =
    typeof opts.totalTokens === 'number'
      ? `${opts.totalTokens.toLocaleString()} tokens`
      : '';

  let warningsHtml = '';
  if (opts.qualityOutliers && opts.qualityOutliers.length > 0) {
    const list = opts.qualityOutliers
      .map(
        (o) =>
          `<li><b>${o.label}</b>: ${o.value} vs ~${o.baseline} ` +
          `(${o.deviationPct > 0 ? '+' : ''}${o.deviationPct}%)</li>`
      )
      .join('');
    warningsHtml +=
      '<div style="background:#fffbeb;border:1px solid #fef3c7;' +
      'padding:10px 14px;border-radius:6px;margin:14px 0">' +
      '<b style="color:#b45309">⚠️ Outliers detected:</b>' +
      '<ul style="margin:6px 0 0;padding-left:20px;color:#92400e">' +
      `${list}</ul></div>`;
  }

  if (opts.autoVsManualDiffs && opts.autoVsManualDiffs.length > 0) {
    const list = opts.autoVsManualDiffs
      .map(
        (d) =>
          `<li><b>${d.key}</b>: auto <code>${d.auto}</code> vs ` +
          `manual <code>${d.manual}</code></li>`
      )
      .join('');
    warningsHtml +=
      '<div style="background:#eff6ff;border:1px solid #dbeafe;' +
      'padding:10px 14px;border-radius:6px;margin:14px 0">' +
      '<b style="color:#1d4ed8">ℹ️ Manual override disagreement:</b>' +
      '<ul style="margin:6px 0 0;padding-left:20px;color:#1e40af">' +
      `${list}</ul></div>`;
  }

  const coreComponents = COMPONENTS.filter((c) => c.tier === 'core');
  const tableRows = coreComponents
    .map((c) => {
      const val = opts.record[c.key];
      const displayVal =
        val !== undefined && val !== null && String(val).trim() !== ''
          ? String(val)
          : '—';
      return (
        '<tr>' +
        '<td style="padding:6px 10px;border-bottom:1px solid #eee">' +
        `${c.label}</td>` +
        '<td style="padding:6px 10px;border-bottom:1px solid #eee;' +
        `color:#666">${c.market}</td>` +
        '<td style="padding:6px 10px;border-bottom:1px solid #eee;' +
        'text-align:right;font-family:monospace">' +
        `<b>${displayVal}</b></td>` +
        '</tr>'
      );
    })
    .join('');

  const sheetUrl =
    `https://docs.google.com/spreadsheets/d/${MASTER_SHEET_ID}/edit`;

  const html =
    '<div style="font-family:system-ui,-apple-system,sans-serif;' +
    'max-width:620px;color:#1f2937;line-height:1.5">' +
    '<h2 style="color:#111827;margin-bottom:8px">' +
    'Extraction Pipeline Succeeded</h2>' +
    '<p style="margin:0 0 16px;color:#4b5563">' +
    `File <b>${opts.filename}</b> was successfully extracted and processed.` +
    '</p>' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:16px;' +
    'background:#f9fafb;border-radius:6px;padding:12px;font-size:14px">' +
    '<tr><td style="padding:4px 8px;color:#6b7280;width:140px">File:</td>' +
    `<td style="padding:4px 8px"><b>${opts.filename}</b></td></tr>` +
    '<tr><td style="padding:4px 8px;color:#6b7280">Issue Date:</td>' +
    `<td style="padding:4px 8px">${opts.record.date}</td></tr>` +
    '<tr><td style="padding:4px 8px;color:#6b7280">Target Tab:</td>' +
    `<td style="padding:4px 8px"><code>${opts.tabTitle}</code> ` +
    `(${opts.action})</td></tr>` +
    '<tr><td style="padding:4px 8px;color:#6b7280">Duration:</td>' +
    `<td style="padding:4px 8px">${durationSec}</td></tr>` +
    '<tr><td style="padding:4px 8px;color:#6b7280">Gemini Cost:</td>' +
    `<td style="padding:4px 8px">${costStr} ${tokensStr}</td></tr>` +
    '</table>' +
    warningsHtml +
    '<h3 style="color:#374151;margin:16px 0 8px;font-size:15px">' +
    'Core Commodity Prices (₹/kg)</h3>' +
    '<table style="width:100%;border-collapse:collapse;font-size:13px;' +
    'margin-bottom:20px">' +
    '<thead>' +
    '<tr style="background:#f3f4f6;text-align:left">' +
    '<th style="padding:6px 10px;border-bottom:2px solid #e5e7eb">' +
    'Commodity</th>' +
    '<th style="padding:6px 10px;border-bottom:2px solid #e5e7eb">' +
    'Market</th>' +
    '<th style="padding:6px 10px;border-bottom:2px solid #e5e7eb;' +
    'text-align:right">Price (₹/kg)</th>' +
    '</tr>' +
    '</thead>' +
    `<tbody>${tableRows}</tbody>` +
    '</table>' +
    '<div style="margin:20px 0;padding-top:12px;' +
    'border-top:1px solid #e5e7eb">' +
    '<p style="margin:0 0 10px;font-size:14px;font-weight:bold">' +
    'Quick Links:</p>' +
    `<a href="${APP_BASE_URL}/#price-review" style="display:inline-block;` +
    'margin-right:12px;color:#2563eb;text-decoration:none">' +
    '📊 Price Review</a> ' +
    `<a href="${APP_BASE_URL}/#monitor" style="display:inline-block;` +
    'margin-right:12px;color:#2563eb;text-decoration:none">' +
    '🖥️ Pipeline Monitor</a> ' +
    `<a href="${sheetUrl}" style="display:inline-block;` +
    'color:#2563eb;text-decoration:none">' +
    '📑 Master Google Sheet</a>' +
    '</div>' +
    '<p style="color:#9ca3af;font-size:12px;margin-top:20px">' +
    'Automated notification from Shuddhi-Moolam.</p>' +
    '</div>';

  try {
    const resend = new Resend(key);
    const { error } = await resend.emails.send({
      from: OUTCOME_EMAIL_FROM,
      to: recipients,
      subject,
      html,
    });
    if (error) {
      logger.error('Resend success email failed', { error });
      return false;
    }
    return true;
  } catch (e: unknown) {
    logger.error('Resend threw sending success email', {
      error: e instanceof Error ? e.message : String(e),
    });
    return false;
  }
}

/**
 * Sends an email notification upon pipeline processing failure (SM-62).
 * Degrades gracefully if RESEND_API_KEY is unset or sending fails.
 * @param {PipelineFailureEmailOptions} opts Failure email parameters.
 * @returns {Promise<boolean>} True if accepted by Resend, false otherwise.
 */
export async function sendPipelineFailureEmail(
  opts: PipelineFailureEmailOptions
): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    logger.warn('RESEND_API_KEY not set — skipping pipeline failure email.');
    return false;
  }

  const recipients = resolveOutcomeRecipients(opts.uploaderEmail);
  const targetLabel = opts.filename || opts.fileId;
  const subject = `Shuddhi-Moolam: Failed to process ${targetLabel}`;
  const timestampStr = new Date(opts.timestamp).toISOString();
  const monitorUrl = `${APP_BASE_URL}/#monitor`;

  const html =
    '<div style="font-family:system-ui,-apple-system,sans-serif;' +
    'max-width:600px;color:#1f2937;line-height:1.5">' +
    '<h2 style="color:#dc2626;margin-bottom:8px">' +
    'Extraction Pipeline Failed</h2>' +
    '<p style="margin:0 0 16px;color:#4b5563">' +
    'An error occurred while processing newsletter file ' +
    `<b>${targetLabel}</b>.</p>` +
    '<div style="background:#fef2f2;border:1px solid #fee2e2;' +
    'padding:14px;border-radius:6px;margin-bottom:20px;font-size:14px">' +
    '<table style="width:100%;border-collapse:collapse">' +
    '<tr><td style="padding:4px 8px;color:#991b1b;width:120px">File:</td>' +
    `<td style="padding:4px 8px"><b>${targetLabel}</b></td></tr>` +
    '<tr><td style="padding:4px 8px;color:#991b1b">File ID:</td>' +
    `<td style="padding:4px 8px"><code>${opts.fileId}</code></td></tr>` +
    '<tr><td style="padding:4px 8px;color:#991b1b">Failed Stage:</td>' +
    `<td style="padding:4px 8px"><b>${opts.failingStage}</b></td></tr>` +
    '<tr><td style="padding:4px 8px;color:#991b1b">Timestamp:</td>' +
    `<td style="padding:4px 8px">${timestampStr}</td></tr>` +
    '<tr><td style="padding:4px 8px;color:#991b1b;vertical-align:top">' +
    'Error:</td>' +
    '<td style="padding:4px 8px;color:#b91c1c;font-family:monospace">' +
    `${opts.errorMessage}</td></tr>` +
    '</table>' +
    '</div>' +
    '<p style="margin-bottom:20px">' +
    'You can inspect error logs and trigger re-processing directly from ' +
    'the Pipeline Monitor:' +
    '</p>' +
    `<a href="${monitorUrl}" style="display:inline-block;background:#dc2626;` +
    'color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none;' +
    'font-weight:bold">' +
    'Go to Pipeline Monitor & Reprocess</a>' +
    '<p style="color:#9ca3af;font-size:12px;margin-top:24px">' +
    'Automated notification from Shuddhi-Moolam.</p>' +
    '</div>';

  try {
    const resend = new Resend(key);
    const { error } = await resend.emails.send({
      from: OUTCOME_EMAIL_FROM,
      to: recipients,
      subject,
      html,
    });
    if (error) {
      logger.error('Resend failure email failed', { error });
      return false;
    }
    return true;
  } catch (e: unknown) {
    logger.error('Resend threw sending failure email', {
      error: e instanceof Error ? e.message : String(e),
    });
    return false;
  }
}
