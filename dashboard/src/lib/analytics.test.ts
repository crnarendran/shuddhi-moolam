import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as firebaseAnalytics from 'firebase/analytics';
import {
  parseVirtualRoute,
  trackPageView,
  trackEvent,
  identifyAnalyticsUser,
  resetAnalyticsForTesting,
  setAnalyticsInstanceForTesting,
} from './analytics';

vi.mock('firebase/analytics', () => ({
  getAnalytics: vi.fn(() => ({ app: {} })),
  isSupported: vi.fn(async () => true),
  logEvent: vi.fn(),
  setUserId: vi.fn(),
  setUserProperties: vi.fn(),
}));

describe('analytics.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAnalyticsForTesting();
    if (typeof globalThis.document === 'undefined') {
      (globalThis as any).document = { title: 'dashboard' };
    } else {
      document.title = 'dashboard';
    }
  });

  describe('parseVirtualRoute', () => {
    it('maps empty hash and root to default guidance report', () => {
      expect(parseVirtualRoute('')).toEqual({
        pagePath: '/reports/guidance',
        pageTitle: 'Purchasing guidance',
        section: 'reports',
        subTab: 'guidance',
      });
      expect(parseVirtualRoute('#')).toEqual({
        pagePath: '/reports/guidance',
        pageTitle: 'Purchasing guidance',
        section: 'reports',
        subTab: 'guidance',
      });
      expect(parseVirtualRoute('#reports')).toEqual({
        pagePath: '/reports/guidance',
        pageTitle: 'Purchasing guidance',
        section: 'reports',
        subTab: 'guidance',
      });
      expect(parseVirtualRoute('#reports/guidance')).toEqual({
        pagePath: '/reports/guidance',
        pageTitle: 'Purchasing guidance',
        section: 'reports',
        subTab: 'guidance',
      });
    });

    it('maps all report sub-tabs accurately', () => {
      expect(parseVirtualRoute('#reports/price-review')).toEqual({
        pagePath: '/reports/price-review',
        pageTitle: 'Price Review',
        section: 'reports',
        subTab: 'price-review',
      });
      expect(parseVirtualRoute('#reports/seasonal')).toEqual({
        pagePath: '/reports/seasonal',
        pageTitle: 'Seasonal analysis',
        section: 'reports',
        subTab: 'seasonal',
      });
      expect(parseVirtualRoute('#reports/cost-impact')).toEqual({
        pagePath: '/reports/cost-impact',
        pageTitle: 'Cost impact analysis',
        section: 'reports',
        subTab: 'cost-impact',
      });
      expect(parseVirtualRoute('#reports/spreads')).toEqual({
        pagePath: '/reports/spreads',
        pageTitle: 'Spread monitor',
        section: 'reports',
        subTab: 'spreads',
      });
    });

    it('maps pipeline monitor route accurately', () => {
      expect(parseVirtualRoute('#monitor')).toEqual({
        pagePath: '/monitor',
        pageTitle: 'Pipeline monitor',
        section: 'monitor',
        subTab: 'monitor',
      });
    });

    it('maps settings section and sub-tabs accurately', () => {
      expect(parseVirtualRoute('#settings')).toEqual({
        pagePath: '/settings/companies',
        pageTitle: 'Settings — Companies & Materials',
        section: 'settings',
        subTab: 'companies',
      });
      expect(parseVirtualRoute('#settings/companies')).toEqual({
        pagePath: '/settings/companies',
        pageTitle: 'Settings — Companies & Materials',
        section: 'settings',
        subTab: 'companies',
      });
      expect(parseVirtualRoute('#settings/commodities')).toEqual({
        pagePath: '/settings/commodities',
        pageTitle: 'Settings — Commodities',
        section: 'settings',
        subTab: 'commodities',
      });
      expect(parseVirtualRoute('#settings/manual')).toEqual({
        pagePath: '/settings/manual',
        pageTitle: 'Settings — Manual entry',
        section: 'settings',
        subTab: 'manual',
      });
      expect(parseVirtualRoute('#settings/admin')).toEqual({
        pagePath: '/settings/admin',
        pageTitle: 'Settings — Admin',
        section: 'settings',
        subTab: 'admin',
      });
    });
  });

  describe('trackPageView', () => {
    it('logs page_view and updates document.title', async () => {
      const mockAnalytics = { app: {} } as any;
      setAnalyticsInstanceForTesting(mockAnalytics);

      await trackPageView('#reports/seasonal');

      expect(document.title).toBe('Shuddhi-Moolam — Seasonal analysis');
      expect(firebaseAnalytics.logEvent).toHaveBeenCalledTimes(1);
      expect(firebaseAnalytics.logEvent).toHaveBeenCalledWith(
        mockAnalytics,
        'page_view',
        expect.objectContaining({
          page_path: '/reports/seasonal',
          page_title: 'Seasonal analysis',
          section: 'reports',
          sub_tab: 'seasonal',
        })
      );
    });

    it('deduplicates consecutive identical page views', async () => {
      const mockAnalytics = { app: {} } as any;
      setAnalyticsInstanceForTesting(mockAnalytics);

      await trackPageView('#reports/seasonal');
      await trackPageView('#reports/seasonal');
      await trackPageView('#reports/seasonal');

      expect(firebaseAnalytics.logEvent).toHaveBeenCalledTimes(1);

      // Navigating to a different page should trigger another event
      await trackPageView('#reports/guidance');
      expect(firebaseAnalytics.logEvent).toHaveBeenCalledTimes(2);
      expect(document.title).toBe('Shuddhi-Moolam — Purchasing guidance');
    });
  });

  describe('identifyAnalyticsUser', () => {
    it('sets user ID and properties for admin user', async () => {
      const mockAnalytics = { app: {} } as any;
      setAnalyticsInstanceForTesting(mockAnalytics);

      await identifyAnalyticsUser({
        uid: 'user_123',
        plan: 'premium',
        isAdmin: true,
        isDataEditor: false,
        workspaceMode: 'own',
      });

      expect(firebaseAnalytics.setUserId).toHaveBeenCalledWith(
        mockAnalytics,
        'user_123'
      );
      expect(firebaseAnalytics.setUserProperties).toHaveBeenCalledWith(
        mockAnalytics,
        {
          user_plan: 'premium',
          user_role: 'admin',
          workspace_mode: 'own',
        }
      );
    });

    it('sets data_editor role when not admin', async () => {
      const mockAnalytics = { app: {} } as any;
      setAnalyticsInstanceForTesting(mockAnalytics);

      await identifyAnalyticsUser({
        uid: 'user_456',
        plan: 'premium',
        isAdmin: false,
        isDataEditor: true,
        workspaceMode: 'shared',
      });

      expect(firebaseAnalytics.setUserProperties).toHaveBeenCalledWith(
        mockAnalytics,
        {
          user_plan: 'premium',
          user_role: 'data_editor',
          workspace_mode: 'shared',
        }
      );
    });

    it('sets viewer role for regular free user', async () => {
      const mockAnalytics = { app: {} } as any;
      setAnalyticsInstanceForTesting(mockAnalytics);

      await identifyAnalyticsUser({
        uid: 'user_789',
        plan: 'free',
        isAdmin: false,
        isDataEditor: false,
        workspaceMode: 'shared',
      });

      expect(firebaseAnalytics.setUserProperties).toHaveBeenCalledWith(
        mockAnalytics,
        {
          user_plan: 'free',
          user_role: 'viewer',
          workspace_mode: 'shared',
        }
      );
    });
  });

  describe('trackEvent', () => {
    it('logs custom event with parameters', async () => {
      const mockAnalytics = { app: {} } as any;
      setAnalyticsInstanceForTesting(mockAnalytics);

      await trackEvent('select_seasonal_commodities', {
        commodity_keys: 'pig_iron,scrap',
        selected_count: 2,
      });

      expect(firebaseAnalytics.logEvent).toHaveBeenCalledWith(
        mockAnalytics,
        'select_seasonal_commodities',
        {
          commodity_keys: 'pig_iron,scrap',
          selected_count: 2,
        }
      );
    });

    it('safely no-ops when analytics is null or unsupported', async () => {
      setAnalyticsInstanceForTesting(null);

      await trackEvent('some_unsupported_event', { key: 'val' });
      expect(firebaseAnalytics.logEvent).not.toHaveBeenCalled();
    });
  });

  describe('getAnalyticsInstance environment safety', () => {
    it('returns null safely in node/SSR environment (window undefined)', async () => {
      const { getAnalyticsInstance } = await import('./analytics');
      const inst = await getAnalyticsInstance();
      expect(inst).toBeNull();
    });

    it('returns null safely if isSupported returns false', async () => {
      (globalThis as any).window = {};
      const origEnv = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID;
      (import.meta.env as any).VITE_FIREBASE_MEASUREMENT_ID = 'G-TEST123';
      vi.mocked(firebaseAnalytics.isSupported).mockResolvedValueOnce(false);

      const { getAnalyticsInstance } = await import('./analytics');
      const inst = await getAnalyticsInstance();
      expect(inst).toBeNull();

      delete (globalThis as any).window;
      (import.meta.env as any).VITE_FIREBASE_MEASUREMENT_ID = origEnv;
    });

    it('initializes getAnalytics when window exists and isSupported is true', async () => {
      (globalThis as any).window = {};
      const origEnv = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID;
      (import.meta.env as any).VITE_FIREBASE_MEASUREMENT_ID = 'G-TEST123';
      vi.mocked(firebaseAnalytics.isSupported).mockResolvedValueOnce(true);

      const { getAnalyticsInstance } = await import('./analytics');
      const inst = await getAnalyticsInstance();
      expect(inst).not.toBeNull();
      expect(firebaseAnalytics.getAnalytics).toHaveBeenCalled();

      delete (globalThis as any).window;
      (import.meta.env as any).VITE_FIREBASE_MEASUREMENT_ID = origEnv;
    });
  });
});
