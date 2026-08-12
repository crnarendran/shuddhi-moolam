import { useState } from 'react';
import { Send, RefreshCw, Trash2, Copy, Check } from 'lucide-react';
import { useInvitations } from '../hooks/useSharing';
import { inviteDisplayStatus, type InviteDisplayStatus } from '../lib/sharing';

const STATUS_STYLE: Record<InviteDisplayStatus, string> = {
  waiting: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 ' +
    'dark:text-amber-300',
  accepted: 'bg-green-100 text-green-700 dark:bg-green-900/30 ' +
    'dark:text-green-300',
  expired: 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300',
  revoked: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};
const STATUS_LABEL: Record<InviteDisplayStatus, string> = {
  waiting: 'Waiting to accept', accepted: 'Accepted',
  expired: 'Expired', revoked: 'Revoked',
};

/**
 * Owner panel to invite read-only viewers to a company and manage the
 * invitations (status, resend, revoke, copy accept link). SM-41.
 * @param props The company to share.
 */
export function SharePanel(
  { companyId }: { companyId: string; companyName: string }
) {
  const { invites, create, resend, revoke } = useInvitations();
  const mine = invites.filter((i) => i.companyId === companyId);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async () => {
    const to = email.trim();
    if (!to) return;
    setBusy(true); setNote(null); setLink(null);
    try {
      const r = await create(companyId, to);
      setEmail('');
      setLink(r.acceptUrl);
      setNote(r.emailSent
        ? `Invitation emailed to ${to}.`
        : 'Email provider not live yet — copy the link below to share.');
    } catch (e) {
      setNote((e as { message?: string }).message ?? 'Could not invite.');
    }
    setBusy(false);
  };

  const copy = (url: string) => {
    void navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4
      flex flex-col gap-3">
      <h4 className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
        Share read-only access
      </h4>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 -mt-1">
        The invitee can view this company’s materials, charts and guidance
        (read-only, its commodities only) — they can’t edit or create their
        own. Invites expire in 7 days; resend or revoke below.
      </p>
      <div className="flex gap-2">
        <input
          type="email" placeholder="invitee@email.com" value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
          className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300
            dark:border-zinc-700 rounded-md py-1.5 px-2 text-sm"
        />
        <button
          onClick={() => void submit()} disabled={busy}
          className="flex items-center gap-1 px-3 rounded-md bg-blue-600
            text-white text-sm disabled:opacity-50"
        ><Send className="h-4 w-4" />Invite</button>
      </div>
      {note && <p className="text-xs text-zinc-500 dark:text-zinc-400">{note}</p>}
      {link && (
        <div className="flex items-center gap-2 text-xs">
          <input readOnly value={link}
            className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200
              dark:border-zinc-700 rounded px-2 py-1 text-zinc-500" />
          <button onClick={() => copy(link)}
            className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy'}</button>
        </div>
      )}

      {mine.length > 0 && (
        <ul className="flex flex-col gap-2 mt-1">
          {mine.map((inv) => {
            const st = inviteDisplayStatus(inv);
            return (
              <li key={inv.id}
                className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate text-zinc-800
                    dark:text-zinc-100">{inv.inviteeEmail}</span>
                  <span className={`inline-block mt-0.5 px-2 py-0.5 rounded
                    text-xs font-medium ${STATUS_STYLE[st]}`}>
                    {STATUS_LABEL[st]}</span>
                </span>
                <span className="flex items-center gap-1 shrink-0">
                  {st !== 'accepted' && st !== 'revoked' && (
                    <button title="Resend" onClick={() => void resend(inv.id!)}
                      className="p-1.5 rounded-md border border-zinc-300
                        dark:border-zinc-700 text-zinc-600 dark:text-zinc-300">
                      <RefreshCw className="h-4 w-4" /></button>
                  )}
                  {st === 'expired' && (
                    <button title="Re-invite" onClick={() => void resend(inv.id!)}
                      className="text-xs px-2 py-1 rounded-md border
                        border-zinc-300 dark:border-zinc-700">Re-invite</button>
                  )}
                  {st !== 'revoked' && (
                    <button title="Revoke" onClick={() => void revoke(inv.id!)}
                      className="p-1.5 rounded-md text-red-500
                        hover:bg-red-50 dark:hover:bg-red-900/20">
                      <Trash2 className="h-4 w-4" /></button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
