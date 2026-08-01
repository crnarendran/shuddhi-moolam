import * as logger from 'firebase-functions/logger';

/**
 * Sends an alert to the configured webhook URL.
 * @param {string} title The title of the alert.
 * @param {string} message The detailed message of the alert.
 * @param {string} [fileId] An optional fileId for correlation.
 * @returns {Promise<void>} A promise that resolves when the alert is sent.
 */
export async function sendAlert(
  title: string,
  message: string,
  fileId?: string
): Promise<void> {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl) {
    logger.warn('ALERT_WEBHOOK_URL not set, skipping alert', {
      title,
      message,
      fileId,
    });
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, message, fileId }),
    });

    if (!response.ok) {
      logger.error('Failed to send alert', {
        status: response.status,
        statusText: response.statusText,
      });
    }
  } catch (error) {
    logger.error('Error sending alert', { error });
  }
}
