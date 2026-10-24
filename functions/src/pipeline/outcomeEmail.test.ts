import {
  resolveOutcomeRecipients,
  sendPipelineSuccessEmail,
  sendPipelineFailureEmail,
  FOUNDER_EMAILS,
  OUTCOME_EMAIL_FROM,
} from './outcomeEmail';
import { Resend } from 'resend';

jest.mock('resend');

describe('Outcome Email Notifications (SM-62)', () => {
  const origEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...origEnv };
  });

  afterAll(() => {
    process.env = origEnv;
  });

  describe('resolveOutcomeRecipients', () => {
    it('returns founder emails when uploader is missing', () => {
      const recipients = resolveOutcomeRecipients(undefined);
      expect(recipients).toEqual(
        FOUNDER_EMAILS.map((e) => e.toLowerCase())
      );
    });

    it('includes valid uploader email deduplicated with founders', () => {
      const recipients = resolveOutcomeRecipients('CRNARENDRAN@GMAIL.COM');
      expect(recipients).toEqual(
        FOUNDER_EMAILS.map((e) => e.toLowerCase())
      );

      const custom = resolveOutcomeRecipients('vendor@supplier.com');
      expect(custom).toContain('vendor@supplier.com');
      expect(custom).toContain('crnarendran@gmail.com');
      expect(custom).toContain('mvsaikishore@gmail.com');
      expect(custom.length).toBe(3);
    });

    it('filters out service account emails (*.gserviceaccount.com)', () => {
      const recipients = resolveOutcomeRecipients(
        'bot@sai-shuddhi-moolam.iam.gserviceaccount.com'
      );
      expect(recipients).toEqual(
        FOUNDER_EMAILS.map((e) => e.toLowerCase())
      );
    });
  });

  describe('sendPipelineSuccessEmail', () => {
    it('returns false and warns if RESEND_API_KEY is not set', async () => {
      delete process.env.RESEND_API_KEY;
      const res = await sendPipelineSuccessEmail({
        filename: 'MMR2026.pdf',
        fileId: 'file-123',
        record: {
          date: '10/08/2026',
          aluminium_ingot: '215',
          copper_cathode: '780',
        },
        tabTitle: '2026',
        action: 'APPEND',
        uploaderEmail: 'user@example.com',
      });
      expect(res).toBe(false);
      expect(Resend).not.toHaveBeenCalled();
    });

    it('sends formatted success email with 16 core commodities and links',
      async () => {
        process.env.RESEND_API_KEY = 're_test_123';
        const mockSend = jest.fn().mockResolvedValue({ error: null });
        (Resend as unknown as jest.Mock).mockImplementation(() => ({
          emails: { send: mockSend },
        }));

        const res = await sendPipelineSuccessEmail({
          filename: 'MMR_10082026.pdf',
          fileId: 'file-123',
          record: {
            date: '10/08/2026',
            aluminium_ingot: '215',
            copper_cathode: '780',
          },
          tabTitle: '2026',
          action: 'APPEND',
          durationMs: 4500,
          totalTokens: 12500,
          estCostUsd: 0.0125,
          uploaderEmail: 'analyst@domain.com',
          qualityOutliers: [
            {
              key: 'copper_cathode',
              label: 'Copper Cathode',
              value: 780,
              baseline: 500,
              deviationPct: 56,
            },
          ],
        });

        expect(res).toBe(true);
        expect(mockSend).toHaveBeenCalledTimes(1);
        const callArgs = mockSend.mock.calls[0][0];
        expect(callArgs.from).toBe(OUTCOME_EMAIL_FROM);
        expect(callArgs.to).toEqual([
          'analyst@domain.com',
          'crnarendran@gmail.com',
          'mvsaikishore@gmail.com',
        ]);
        expect(callArgs.subject).toBe(
          'Shuddhi-Moolam: Processed MMR_10082026.pdf (Issue 10/08/2026)'
        );
        expect(callArgs.html).toContain('MMR_10082026.pdf');
        expect(callArgs.html).toContain('10/08/2026');
        expect(callArgs.html).toContain('APPEND');
        expect(callArgs.html).toContain('4.5s');
        expect(callArgs.html).toContain('$0.0125');
        expect(callArgs.html).toContain('Aluminium Ingot');
        expect(callArgs.html).toContain('215');
        expect(callArgs.html).toContain('Copper Cathode');
        expect(callArgs.html).toContain('Outliers detected');
        expect(callArgs.html).toContain('#price-review');
        expect(callArgs.html).toContain('#monitor');
        expect(callArgs.html).toContain('spreadsheets/d/');
      }
    );

    it('handles manual override kept and Resend API errors gracefully',
      async () => {
        process.env.RESEND_API_KEY = 're_test_123';
        const mockSend = jest.fn().mockResolvedValue({
          error: { message: 'Provider rate limited' },
        });
        (Resend as unknown as jest.Mock).mockImplementation(() => ({
          emails: { send: mockSend },
        }));

        const res = await sendPipelineSuccessEmail({
          filename: 'MMR_manual.pdf',
          fileId: 'file-456',
          record: { date: '17/08/2026' },
          tabTitle: '2026',
          action: 'MANUAL_OVERRIDE_KEPT',
          autoVsManualDiffs: [
            { key: 'lead_ingot', auto: '180', manual: '185' },
          ],
        });

        expect(res).toBe(false);
        expect(mockSend).toHaveBeenCalledTimes(1);
        const callArgs = mockSend.mock.calls[0][0];
        expect(callArgs.html).toContain('MANUAL_OVERRIDE_KEPT');
        expect(callArgs.html).toContain('Manual override disagreement');
      }
    );
  });

  describe('sendPipelineFailureEmail', () => {
    it('returns false and warns if RESEND_API_KEY is missing', async () => {
      delete process.env.RESEND_API_KEY;
      const res = await sendPipelineFailureEmail({
        fileId: 'f-fail-1',
        filename: 'broken.pdf',
        failingStage: 'extracting',
        errorMessage: 'Gemini rate limit exceeded',
        timestamp: Date.now(),
      });
      expect(res).toBe(false);
    });

    it('sends failure email with stage, error message, and monitor link',
      async () => {
        process.env.RESEND_API_KEY = 're_test_123';
        const mockSend = jest.fn().mockResolvedValue({ error: null });
        (Resend as unknown as jest.Mock).mockImplementation(() => ({
          emails: { send: mockSend },
        }));

        const ts = Date.now();
        const res = await sendPipelineFailureEmail({
          fileId: 'f-fail-2',
          filename: 'corrupted.pdf',
          failingStage: 'downloading',
          errorMessage: 'Corrupt PDF stream',
          timestamp: ts,
          uploaderEmail: 'uploader@domain.com',
        });

        expect(res).toBe(true);
        expect(mockSend).toHaveBeenCalledTimes(1);
        const callArgs = mockSend.mock.calls[0][0];
        expect(callArgs.to).toContain('uploader@domain.com');
        expect(callArgs.subject).toBe(
          'Shuddhi-Moolam: Failed to process corrupted.pdf'
        );
        expect(callArgs.html).toContain('corrupted.pdf');
        expect(callArgs.html).toContain('f-fail-2');
        expect(callArgs.html).toContain('downloading');
        expect(callArgs.html).toContain('Corrupt PDF stream');
        expect(callArgs.html).toContain('#monitor');
        expect(callArgs.html).toContain('Reprocess');
      }
    );
  });
});
