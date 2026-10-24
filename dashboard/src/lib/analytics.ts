import {
  getAnalytics,
  isSupported,
  logEvent,
  setUserId,
  setUserProperties,
  type Analytics,
} from 'firebase/analytics';
import { app } from '../firebase';

export interface VirtualRoute {
  pagePath: string;
  pageTitle: string;
  section: string;
  subTab: string;
}

export interface IdentifyUserOptions {
  uid: string | null;
  plan: 'premium' | 'free';
  isAdmin: boolean;
  isDataEditor: boolean;
  workspaceMode: 'own' | 'shared';
}

let analyticsInstance: Analytics | null = null;
let initPromise: Promise<Analytics | null> | null = null;
let lastTrackedPath: string | null = null;

/**
 * Lazily initialize Firebase Analytics only in supported browser environments
 * where a Measurement ID is configured.
 */
export async function getAnalyticsInstance(): Promise<Analytics | null> {
  if (analyticsInstance) return analyticsInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (typeof window === 'undefined') return null;
    const measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID;
    if (!measurementId) return null;

    try {
      const supported = await isSupported();
      if (!supported) return null;
      analyticsInstance = getAnalytics(app);
      return analyticsInstance;
    } catch {
      return null;
    }
  })();

  return initPromise;
}

/**
 * Parse an SPA route hash into a standardized virtual page path, title,
 * section, and sub-tab.
 */
export function parseVirtualRoute(rawHash: string): VirtualRoute {
  const clean = (rawHash || '').replace(/^#\/?/, '').trim();
  const [base, sub] = clean.split('/');

  if (base === 'monitor') {
    return {
      pagePath: '/monitor',
      pageTitle: 'Pipeline monitor',
      section: 'monitor',
      subTab: 'monitor',
    };
  }

  if (base === 'settings') {
    if (sub === 'commodities') {
      return {
        pagePath: '/settings/commodities',
        pageTitle: 'Settings — Commodities',
        section: 'settings',
        subTab: 'commodities',
      };
    }
    if (sub === 'manual') {
      return {
        pagePath: '/settings/manual',
        pageTitle: 'Settings — Manual entry',
        section: 'settings',
        subTab: 'manual',
      };
    }
    if (sub === 'admin') {
      return {
        pagePath: '/settings/admin',
        pageTitle: 'Settings — Admin',
        section: 'settings',
        subTab: 'admin',
      };
    }
    return {
      pagePath: '/settings/companies',
      pageTitle: 'Settings — Companies & Materials',
      section: 'settings',
      subTab: 'companies',
    };
  }

  // Reports (default section)
  if (sub === 'price-review') {
    return {
      pagePath: '/reports/price-review',
      pageTitle: 'Price Review',
      section: 'reports',
      subTab: 'price-review',
    };
  }
  if (sub === 'seasonal') {
    return {
      pagePath: '/reports/seasonal',
      pageTitle: 'Seasonal analysis',
      section: 'reports',
      subTab: 'seasonal',
    };
  }
  if (sub === 'cost-impact') {
    return {
      pagePath: '/reports/cost-impact',
      pageTitle: 'Cost impact analysis',
      section: 'reports',
      subTab: 'cost-impact',
    };
  }
  if (sub === 'spreads') {
    return {
      pagePath: '/reports/spreads',
      pageTitle: 'Spread monitor',
      section: 'reports',
      subTab: 'spreads',
    };
  }

  // Default is Purchasing guidance
  return {
    pagePath: '/reports/guidance',
    pageTitle: 'Purchasing guidance',
    section: 'reports',
    subTab: 'guidance',
  };
}

/**
 * Track a virtual SPA page view in GA4 with deduplication of consecutive
 * identical routes, and update document.title.
 */
export async function trackPageView(hash: string): Promise<void> {
  const route = parseVirtualRoute(hash);
  if (route.pagePath === lastTrackedPath) {
    return;
  }
  lastTrackedPath = route.pagePath;

  if (typeof document !== 'undefined') {
    document.title = `Shuddhi-Moolam — ${route.pageTitle}`;
  }

  try {
    const analytics = await getAnalyticsInstance();
    if (!analytics) return;
    const location = typeof window !== 'undefined'
      ? window.location.href
      : route.pagePath;
    logEvent(analytics, 'page_view', {
      page_path: route.pagePath,
      page_title: route.pageTitle,
      page_location: location,
      section: route.section,
      sub_tab: route.subTab,
    });
  } catch {
    // Non-blocking telemetry
  }
}

/**
 * Set the user ID and user properties (plan, role, workspace mode) in GA4.
 */
export async function identifyAnalyticsUser(
  opts: IdentifyUserOptions
): Promise<void> {
  try {
    const analytics = await getAnalyticsInstance();
    if (!analytics) return;
    setUserId(analytics, opts.uid);
    const userRole = opts.isAdmin
      ? 'admin'
      : opts.isDataEditor
        ? 'data_editor'
        : 'viewer';
    setUserProperties(analytics, {
      user_plan: opts.plan,
      user_role: userRole,
      workspace_mode: opts.workspaceMode,
    });
  } catch {
    // Non-blocking telemetry
  }
}

/**
 * Log a custom GA4 event safely.
 */
export async function trackEvent(
  name: string,
  params?: Record<string, string | number | boolean>
): Promise<void> {
  try {
    const analytics = await getAnalyticsInstance();
    if (!analytics) return;
    logEvent(analytics, name, params);
  } catch {
    // Non-blocking telemetry
  }
}

/**
 * Reset internal state for test isolation.
 */
export function resetAnalyticsForTesting(): void {
  analyticsInstance = null;
  initPromise = null;
  lastTrackedPath = null;
}

/**
 * Inject or clear an analytics instance directly for tests.
 */
export function setAnalyticsInstanceForTesting(inst: Analytics | null): void {
  analyticsInstance = inst;
  initPromise = Promise.resolve(inst);
}
