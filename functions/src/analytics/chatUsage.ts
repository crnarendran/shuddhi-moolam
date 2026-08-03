import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';

const INPUT_USD_PER_1M =
  parseFloat(process.env.GEMINI_INPUT_USD_PER_1M || '') || 0.075;
const OUTPUT_USD_PER_1M =
  parseFloat(process.env.GEMINI_OUTPUT_USD_PER_1M || '') || 0.3;

/**
 * Rough token estimate from a character count (~4 chars per token).
 * @param {string} text - The text to estimate.
 * @returns {number} An estimated token count.
 */
export function estimateTokens(text: string): number {
  return Math.ceil((text ? text.length : 0) / 4);
}

/**
 * Estimated USD cost of a chat turn from input/output token estimates.
 * @param {number} tokensIn - Estimated input tokens.
 * @param {number} tokensOut - Estimated output tokens.
 * @returns {number} Estimated cost in USD.
 */
export function estimateChatCostUsd(
  tokensIn: number,
  tokensOut: number
): number {
  return (tokensIn / 1_000_000) * INPUT_USD_PER_1M +
    (tokensOut / 1_000_000) * OUTPUT_USD_PER_1M;
}

interface HistMsg {
  role?: string;
  content?: string;
}

/**
 * Records one chat turn's estimated usage/cost to the env-suffixed
 * `chat_usage` collection, kept separate from the pipeline's extraction cost.
 * The Data Analytics API does not return token counts, so input tokens are
 * estimated from the message + history text and output is recorded as 0 (an
 * input-dominated estimate). Never throws — chat must not break on logging.
 * @param {string} message - The user's new message.
 * @param {HistMsg[] | undefined} history - Prior chat turns.
 * @returns {Promise<void>} Resolves when logged (or skipped on error).
 */
export async function recordChatUsage(
  message: string,
  history: HistMsg[] | undefined
): Promise<void> {
  try {
    const env = process.env.APP_ENV || 'dev';
    const isProd = env === 'main' || env === 'prod';
    const collection = isProd ? 'chat_usage' : `chat_usage_${env}`;
    const histText = Array.isArray(history)
      ? history.map((m) => m.content || '').join(' ')
      : '';
    const tokensIn = estimateTokens(`${message || ''} ${histText}`);
    const estCostUsd = estimateChatCostUsd(tokensIn, 0);
    await getFirestore().collection(collection).add({
      at: FieldValue.serverTimestamp(),
      messageChars: (message || '').length,
      tokensIn,
      estCostUsd,
    });
  } catch (error) {
    logger.warn('Failed to record chat usage', { error });
  }
}
