import { onRequest } from 'firebase-functions/v2/https';
import cors from 'cors';
import {
  DataChatServiceClient
} from '@google-cloud/geminidataanalytics/build/src/v1beta';
import { recordChatUsage } from './chatUsage';

const corsHandler = cors({ origin: true });
const chatClient = new DataChatServiceClient();

export const chatEndpoint = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    const { message, history } = req.body;

    // Record estimated chat usage separately from pipeline cost (SM-27).
    // Fire-and-forget; must never affect the chat response.
    void recordChatUsage(message, history);

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
      const chatRequest = {
        parent: `projects/${PROJECT_ID}/locations/us`,
        messages: formattedHistory,
        inlineContext: {
          systemInstruction:
            'You are a friendly data analytics assistant. ' +
            'Write SQL against BigQuery to answer user questions ' +
            'about the extracted newsletter data in pipeline_runs.',
          datasourceReferences: {
            bq: {
              tableReferences: [
                {
                  projectId: PROJECT_ID,
                  datasetId: 'extracted_data',
                  tableId: 'pipeline_runs',
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
