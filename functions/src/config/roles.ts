// Shared access-control allowlists. Keep in sync with the client
// (dashboard/src/hooks/usePlan.ts) and firestore.rules.
//
// - ADMIN: Monitor tab, plans panel, seed, probe, sheet backfill.
// - FOUNDER: grandfathered premium (not necessarily admin).
// - DATA_EDITOR: the manual price-entry tool (SM-57) ONLY — a narrow grant
//   so mvsaikishore can correct/enter prices without full admin access.
export const ADMIN_EMAILS = ['crnarendran@gmail.com'];
export const FOUNDER_EMAILS = [
  'crnarendran@gmail.com', 'mvsaikishore@gmail.com',
];
export const DATA_EDITOR_EMAILS = [
  'crnarendran@gmail.com', 'mvsaikishore@gmail.com',
];

/**
 * Whether an email may use the manual price-entry tool (SM-57).
 * @param {string | undefined | null} email - The caller's email.
 * @returns {boolean} True if the email is a data editor.
 */
export function isDataEditor(email: string | undefined | null): boolean {
  return !!email && DATA_EDITOR_EMAILS.includes(email.toLowerCase());
}
