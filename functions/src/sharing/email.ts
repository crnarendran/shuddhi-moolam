import { Resend } from 'resend';
import * as logger from 'firebase-functions/logger';

const FROM = 'Shuddhi-Moolam <sai-shuddhi-moolam-no-reply@narensportal.com>';

interface InviteEmail {
  to: string;
  companyName: string;
  ownerEmail: string;
  acceptUrl: string;
}

/**
 * Sends a read-only-share invitation email via Resend (SM-41). Reads the
 * RESEND_API_KEY secret at runtime; if it is absent the send is skipped (so
 * invites still work in a copy-the-link degraded mode) and false is returned.
 * @param {InviteEmail} opts Recipient + invite details.
 * @returns {Promise<boolean>} True if the provider accepted the send.
 */
export async function sendInviteEmail(opts: InviteEmail): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    logger.warn('RESEND_API_KEY not set — skipping invite email.');
    return false;
  }
  const { to, companyName, ownerEmail, acceptUrl } = opts;
  const html =
    '<div style="font-family:system-ui,sans-serif;max-width:520px">' +
    `<h2>You've been invited to view <b>${companyName}</b></h2>` +
    `<p>${ownerEmail} has shared the company <b>${companyName}</b> with you ` +
    'on Shuddhi-Moolam in <b>read-only</b> mode — its materials and the ' +
    'related price charts and purchasing guidance.</p>' +
    `<p><a href="${acceptUrl}" ` +
    'style="display:inline-block;background:#2563eb;' +
    'color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">' +
    'View shared company</a></p>' +
    '<p style="color:#666;font-size:13px">This invitation expires in 7 days. ' +
    'If the button does not work, open this link:<br>' +
    `<a href="${acceptUrl}">${acceptUrl}</a></p>` +
    '<p style="color:#999;font-size:12px">If you did not expect this, you ' +
    'can ignore this email.</p></div>';
  try {
    const resend = new Resend(key);
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: `You've been invited to view ${companyName} on Shuddhi-Moolam`,
      html,
    });
    if (error) {
      logger.error('Resend send failed', { error });
      return false;
    }
    return true;
  } catch (e: unknown) {
    logger.error('Resend threw', {
      error: e instanceof Error ? e.message : String(e),
    });
    return false;
  }
}
