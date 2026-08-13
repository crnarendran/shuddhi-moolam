import { useCallback, useEffect, useRef, useState } from 'react';
import { useUserSettings } from './useUserSettings';
import { useView } from '../context/ViewContext';
import { type ViewState } from '../lib/userSettings';

interface UseViewState<T> {
  value: T;
  setValue: (patch: Partial<T>) => void;
  loading: boolean;
}

/**
 * Reads a report's persisted view-state slice (SM-39) and returns a debounced
 * saver. Hydrates once from Firestore when settings finish loading (merged
 * over `defaults`), after which the local value is authoritative so the
 * snapshot echo doesn't clobber the user's edits. Writes are debounced ~500ms
 * to avoid a write storm on slider/select drags. When signed out it stays on
 * defaults and saving is a no-op (via useUserSettings).
 *
 * Selections are namespaced by the active view context (SM-52) — 'own' for the
 * user's workspace, or the shared companyId — so each company/workspace keeps
 * its own selection and switching context re-hydrates that context's state.
 * @param report Which view-state slice to persist.
 * @param defaults The slice's defaults (pass a stable/memoised object).
 */
export function useViewState<K extends keyof ViewState>(
  report: K,
  defaults: NonNullable<ViewState[K]>
): UseViewState<NonNullable<ViewState[K]>> {
  type T = NonNullable<ViewState[K]>;
  const { settings, update, loading } = useUserSettings();
  const { shared } = useView();
  const ctx = shared?.companyId ?? 'own';
  const [value, setV] = useState<T>(defaults);
  const defaultsRef = useRef(defaults);
  const hydratedCtx = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (loading) return;
    // Re-hydrate whenever the context changes; the per-ctx guard also lets the
    // post-save snapshot echo through without clobbering the user's edits.
    if (hydratedCtx.current === ctx) return;
    const stored =
      settings.viewState?.[ctx]?.[report] as Partial<T> | undefined;
    setV({ ...defaultsRef.current, ...stored });
    hydratedCtx.current = ctx;
  }, [loading, settings, report, ctx]);

  const setValue = useCallback(
    (patch: Partial<T>) => {
      setV((prev) => {
        const next = { ...prev, ...patch };
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          void update({
            viewState:
              { [ctx]: { [report]: next } } as Record<string, ViewState>,
          });
        }, 500);
        return next;
      });
    },
    [ctx, report, update]
  );

  return { value, setValue, loading };
}
