import { getAuth } from 'firebase-admin/auth';
import { Firestore, getFirestore } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';
import {
  APP_ENV,
  COMPANIES_COLLECTION,
  HISTORICAL_COLLECTION,
  isProduction,
} from '../config';
import { FOUNDER_EMAILS } from '../config/roles';
import { PriceRecord } from './aggregate';
import {
  CompositionItem,
  evaluateBuyWindows,
  MaterialSpec,
  resolveGuidanceAlertRecipient,
  sendGuidanceAlertEmail,
} from './guidanceAlerts';

const DEFAULT_DIP_THRESHOLD_PCT = 3;
const MIN_DIP_THRESHOLD_PCT = 1;
const MAX_DIP_THRESHOLD_PCT = 50;

interface GuidanceAlertSettingsDoc {
  enabled?: unknown;
  email?: unknown;
  dipThresholdPct?: unknown;
}

interface UserSettingsDoc {
  guidanceAlerts?: GuidanceAlertSettingsDoc;
}

interface CompanyDoc {
  name?: unknown;
  ownerEmail?: unknown;
}

interface MaterialDoc {
  name?: unknown;
  composition?: unknown;
}

/**
 * Normalizes a raw Firestore threshold into a safe positive percentage.
 * @param {unknown} raw Raw `dipThresholdPct` value from `user_settings`.
 * @returns {number} Clamped threshold percentage (1 to 50, default 3).
 */
function normalizeThreshold(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_DIP_THRESHOLD_PCT;
  }
  return Math.min(MAX_DIP_THRESHOLD_PCT, Math.max(MIN_DIP_THRESHOLD_PCT, raw));
}

/**
 * Safely parses a Firestore material composition array.
 * @param {unknown} raw Raw composition field from Firestore.
 * @returns {CompositionItem[]} Validated composition items.
 */
function parseComposition(raw: unknown): CompositionItem[] {
  if (!Array.isArray(raw)) return [];
  const items: CompositionItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as { commodityKey?: unknown; ratio?: unknown };
    if (typeof obj.commodityKey !== 'string' || !obj.commodityKey) continue;
    if (typeof obj.ratio !== 'number' || !Number.isFinite(obj.ratio)) continue;
    items.push({ commodityKey: obj.commodityKey, ratio: obj.ratio });
  }
  return items;
}

/**
 * Loads all materials owned by `uid` across `COMPANIES_COLLECTION` along with
 * any denormalized `ownerEmail` found on the user's company documents.
 * @param {Firestore} db Firestore instance.
 * @param {string} uid Target user UID.
 * @returns {Promise<{ materials: MaterialSpec[]; ownerEmail?: string }>}
 *   Owned materials and optional denormalized owner email.
 */
async function loadUserMaterials(
  db: Firestore,
  uid: string
): Promise<{ materials: MaterialSpec[]; ownerEmail?: string }> {
  const companiesSnap = await db
    .collection(COMPANIES_COLLECTION)
    .where('ownerUid', '==', uid)
    .get();
  if (companiesSnap.empty) {
    return { materials: [] };
  }

  const materials: MaterialSpec[] = [];
  let ownerEmail: string | undefined;

  for (const compDoc of companiesSnap.docs) {
    const comp = compDoc.data() as CompanyDoc;
    if (
      !ownerEmail &&
      typeof comp.ownerEmail === 'string' &&
      comp.ownerEmail.trim()
    ) {
      ownerEmail = comp.ownerEmail.trim();
    }
    const companyName =
      typeof comp.name === 'string' && comp.name.trim()
        ? comp.name.trim()
        : compDoc.id;

    const matSnap = await compDoc.ref.collection('materials').get();
    for (const matDoc of matSnap.docs) {
      const mat = matDoc.data() as MaterialDoc;
      const composition = parseComposition(mat.composition);
      if (composition.length === 0) continue;
      const name =
        typeof mat.name === 'string' && mat.name.trim()
          ? mat.name.trim()
          : matDoc.id;
      materials.push({
        id: matDoc.id,
        name,
        companyName,
        composition,
      });
    }
  }

  return { materials, ownerEmail };
}

/**
 * Verifies whether `uid` holds a premium entitlement via `entitlements/{uid}`
 * (`plan === 'premium'`) or a verified Firebase Auth email in `FOUNDER_EMAILS`.
 * Never checks user-editable `user_settings` emails to prevent spoofing.
 * @param {Firestore} db Firestore instance.
 * @param {string} uid Target user UID.
 * @returns {Promise<{ isPremium: boolean; authEmail?: string }>}
 *   Entitlement verdict and optional verified Auth email.
 */
async function checkPremiumEntitlement(
  db: Firestore,
  uid: string
): Promise<{ isPremium: boolean; authEmail?: string }> {
  try {
    const entDoc = await db.collection('entitlements').doc(uid).get();
    if (entDoc.data()?.plan === 'premium') {
      return { isPremium: true };
    }
  } catch (err: unknown) {
    logger.warn('Failed to read entitlements doc for guidance alert', {
      uid,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  try {
    const user = await getAuth().getUser(uid);
    const authEmail = user.email?.trim() || undefined;
    const lower = authEmail?.toLowerCase();
    const isFounder =
      !!lower &&
      FOUNDER_EMAILS.some((founder) => founder.toLowerCase() === lower);
    return { isPremium: isFounder, authEmail };
  } catch (err: unknown) {
    logger.warn('Failed to verify Firebase Auth user for guidance alert', {
      uid,
      error: err instanceof Error ? err.message : String(err),
    });
    return { isPremium: false };
  }
}

/**
 * Resolves a fallback owner email from company metadata or Firebase Auth.
 * @param {string} uid User UID.
 * @param {string | undefined} prefEmail Preferred contact email if configured.
 * @param {string | undefined} companyOwnerEmail Denormalized company email.
 * @param {string | undefined} cachedAuthEmail Auth email if already fetched.
 * @returns {Promise<string | undefined>} Fallback email if found.
 */
async function resolveFallbackOwnerEmail(
  uid: string,
  prefEmail: string | undefined,
  companyOwnerEmail: string | undefined,
  cachedAuthEmail?: string
): Promise<string | undefined> {
  if (prefEmail?.trim() || companyOwnerEmail || !isProduction(APP_ENV)) {
    return companyOwnerEmail;
  }
  if (cachedAuthEmail) {
    return cachedAuthEmail;
  }
  try {
    const user = await getAuth().getUser(uid);
    return user.email || undefined;
  } catch (err: unknown) {
    logger.warn('Failed to look up Firebase Auth user for guidance alert', {
      uid,
      error: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}

/**
 * Runs the weekly guidance alert evaluation and emails each opted-in user
 * whose materials trigger a buy-window signal.
 * @returns {Promise<void>} Resolves when all opted-in users are processed.
 */
export async function runGuidanceAlertsJob(): Promise<void> {
  const db = getFirestore();
  const settingsSnap = await db
    .collection('user_settings')
    .where('guidanceAlerts.enabled', '==', true)
    .get();

  if (settingsSnap.empty) {
    logger.info('Guidance alerts: no opted-in users.');
    return;
  }

  const histSnap = await db.collection(HISTORICAL_COLLECTION).get();
  const records = histSnap.docs.map((d) => d.data() as PriceRecord);
  if (records.length === 0) {
    logger.info('Guidance alerts: no historical price records available.');
    return;
  }

  let emailsSent = 0;
  for (const userDoc of settingsSnap.docs) {
    const uid = userDoc.id;
    try {
      const entitlement = await checkPremiumEntitlement(db, uid);
      if (!entitlement.isPremium) {
        logger.info('Guidance alerts: skipping non-premium user', { uid });
        continue;
      }

      const settings = userDoc.data() as UserSettingsDoc;
      const prefs = settings.guidanceAlerts;
      const prefEmail =
        typeof prefs?.email === 'string' ? prefs.email : undefined;
      const dipThresholdPct = normalizeThreshold(prefs?.dipThresholdPct);

      const { materials, ownerEmail } = await loadUserMaterials(db, uid);
      if (materials.length === 0) continue;

      const opportunities = evaluateBuyWindows(materials, records, {
        dipThresholdPct,
      });
      if (opportunities.length === 0) continue;

      const fallbackEmail = await resolveFallbackOwnerEmail(
        uid,
        prefEmail,
        ownerEmail,
        entitlement.authEmail
      );
      const to = resolveGuidanceAlertRecipient(
        prefEmail,
        fallbackEmail,
        APP_ENV
      );
      if (!to) {
        logger.warn('Guidance alerts: skipping user with no valid email', {
          uid,
        });
        continue;
      }

      const sent = await sendGuidanceAlertEmail({ to, opportunities });
      if (sent) emailsSent += 1;
    } catch (err: unknown) {
      logger.error('Guidance alerts: error processing user', {
        uid,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info('Guidance alerts job finished.', {
    optedInUsers: settingsSnap.size,
    emailsSent,
  });
}

/**
 * Weekly scheduled Cloud Function (Monday 09:00 UTC) sending consolidated
 * purchasing guidance alerts to opted-in users (SM-70).
 */
export const guidanceAlert = onSchedule(
  { schedule: '0 9 * * 1', secrets: ['RESEND_API_KEY'] },
  async () => {
    await runGuidanceAlertsJob();
  }
);
