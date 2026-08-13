/* eslint-disable max-len, jsdoc/require-param, jsdoc/require-returns, @typescript-eslint/no-unused-vars, jsdoc/require-jsdoc, jsdoc/require-param-description, jsdoc/require-param-type */
import { onRequest } from 'firebase-functions/v2/https';
import cors from 'cors';
import {
  DataChatServiceClient
} from '@google-cloud/geminidataanalytics/build/src/v1beta';
import { recordChatUsage } from './chatUsage';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Filter } from 'firebase-admin/firestore';
import { COMPANIES_COLLECTION, FIRESTORE_COLLECTION, HISTORICAL_COLLECTION } from '../config';

const corsHandler = cors({ origin: true });
const chatClient = new DataChatServiceClient();

export const chatEndpoint = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    // 1. Verify Auth Token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).send('Unauthorized: Missing or invalid Bearer token.');
      return;
    }

    let uid: string;
    let email: string;
    try {
      const token = authHeader.split('Bearer ')[1];
      const decodedToken = await getAuth().verifyIdToken(token);
      uid = decodedToken.uid;
      email = (decodedToken.email || '').toLowerCase();
    } catch (err) {
      console.error('Auth verification failed:', err);
      res.status(401).send('Unauthorized: Invalid token.');
      return;
    }

    // 1.5 Verify Premium Entitlement
    const FOUNDER_EMAILS = ['crnarendran@gmail.com', 'mvsaikishore@gmail.com'];
    let isPremium = FOUNDER_EMAILS.includes(email);
    if (!isPremium) {
      try {
        const entDoc = await getFirestore().collection('entitlements').doc(uid).get();
        if (entDoc.exists && entDoc.data()?.plan === 'premium') {
          isPremium = true;
        }
      } catch (err) {
        console.error('Error fetching entitlements:', err);
      }
    }

    if (!isPremium) {
      res.status(403).send('Forbidden: Ask AI requires a Premium plan.');
      return;
    }

    const { message, history } = req.body;

    // Record estimated chat usage separately from pipeline cost (SM-27).
    // Fire-and-forget; must never affect the chat response.
    void recordChatUsage(message, history);

    // 2. Resolve accessible companies for the user
    let allowedCompanyIds: string[] = [];
    try {
      const db = getFirestore();
      // User has access if they are the owner OR if they are in the viewerUids array.
      const snap = await db.collection(COMPANIES_COLLECTION).where(
        Filter.or(
          Filter.where('ownerUid', '==', uid),
          Filter.where('viewerUids', 'array-contains', uid)
        )
      ).get();
      allowedCompanyIds = snap.docs.map(doc => doc.id);
    } catch (err) {
      console.error('Failed to resolve accessible companies:', err);
      res.status(500).send('Internal Server Error: Failed to resolve data access.');
      return;
    }

    if (allowedCompanyIds.length === 0) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.write(`data: ${JSON.stringify({ type: 'FINAL_RESPONSE', content: 'You do not currently have access to any companies.' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    // Initialize SSE streaming headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formattedHistory: any[] = [];
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        if (msg.role === 'user') {
          formattedHistory.push({ userMessage: { text: msg.content } });
        } else if (msg.role === 'model') {
          formattedHistory.push({
            systemMessage: { text: { parts: [msg.content] } },
          });
        }
      }
    }

    // Append new user message
    formattedHistory.push({ userMessage: { text: message } });

    try {
      const PROJECT_ID =
        process.env.GCLOUD_PROJECT ||
        process.env.GOOGLE_CLOUD_PROJECT ||
        'sai-shuddhi-moolam';

      const allowedIdsStr = allowedCompanyIds.map(id => `'${id}'`).join(', ');

      const chatRequest = {
        parent: `projects/${PROJECT_ID}/locations/us`,
        messages: formattedHistory,
        inlineContext: {
          systemInstruction:
            'You are a friendly data analytics assistant. ' +
            'Write SQL against BigQuery to answer user questions ' +
            'about the Shuddhi-Moolam data in extracted_data. ' +
            'CRITICAL SECURITY RULE: The user is ONLY authorized to view company-specific data for the following company IDs: ' +
            `[${allowedIdsStr}]. ` +
            `When querying the \`${HISTORICAL_COLLECTION}\` or \`${COMPANIES_COLLECTION}\` tables, you MUST explicitly include a \`WHERE companyId IN (...)\` or \`WHERE id IN (...)\` filter using exactly this list to ensure no other company data is returned. ` +
            `Note: The \`${FIRESTORE_COLLECTION}\` table contains global newsletter prices and does not require this filter.`,
          datasourceReferences: {
            bq: {
              tableReferences: [
                {
                  projectId: PROJECT_ID,
                  datasetId: 'extracted_data',
                  tableId: FIRESTORE_COLLECTION,
                },
                {
                  projectId: PROJECT_ID,
                  datasetId: 'extracted_data',
                  tableId: HISTORICAL_COLLECTION,
                },
                {
                  projectId: PROJECT_ID,
                  datasetId: 'extracted_data',
                  tableId: COMPANIES_COLLECTION,
                },
              ],
            },
          },
          options: { chart: {} },
        },
      };

      const stream = chatClient.chat(chatRequest);

      stream.on('data', (response) => {
        const sysMsg = response.systemMessage;
        if (!sysMsg) return;

        // Emit Interactive Suggestions (Buttons)
        if (sysMsg.suggestions && sysMsg.suggestions.length > 0) {
          for (const suggestion of sysMsg.suggestions) {
            res.write(
              `data: ${JSON.stringify({
                type: 'SUGGESTION',
                content: suggestion.title,
              })}\n\n`,
            );
          }
        }

        // Detect Context (THOUGHT) vs Output (FINAL_RESPONSE) or Suggestions
        if (sysMsg.text && sysMsg.text.parts) {
          const typeValue = sysMsg.textType ?? sysMsg.text.textType;

          if (
            typeValue === 'TEXT_TYPE_UNSPECIFIED' ||
            typeValue === 'UNSPECIFIED' ||
            typeValue === 0
          ) {
            for (const suggestion of sysMsg.text.parts) {
              if (suggestion && suggestion.trim()) {
                res.write(
                  `data: ${JSON.stringify({
                    type: 'SUGGESTION',
                    content: suggestion.trim(),
                  })}\n\n`,
                );
              }
            }
          } else {
            const textContent = sysMsg.text.parts.join('\n');
            let evtType = 'FINAL_RESPONSE';

            if (
              typeValue === 'TEXT_TYPE_THOUGHT' ||
              typeValue === 'THOUGHT' ||
              typeValue === 1
            ) {
              evtType = 'THOUGHT';
            }

            res.write(
              `data: ${JSON.stringify({
                type: evtType,
                content: textContent,
              })}\n\n`,
            );
          }
        }
      });

      stream.on('end', () => {
        res.write('data: [DONE]\n\n');
        res.end();
      });

      stream.on('error', (err) => {
        console.error('Gemini API Error:', err);
        res.write(
          `data: ${JSON.stringify({
            type: 'FINAL_RESPONSE',
            content: '\n\n**API Error**: ' + err.message,
          })}\n\n`,
        );
        res.write('data: [DONE]\n\n');
        res.end();
      });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error('Failure Setting Up Chat:', error);
      res.write(
        `data: ${JSON.stringify({
          type: 'FINAL_RESPONSE',
          content: 'Connection failed.',
        })}\n\n`,
      );
      res.write('data: [DONE]\n\n');
      res.end();
    }
  });
});
