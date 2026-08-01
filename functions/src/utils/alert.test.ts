import { sendAlert } from './alert';
import * as logger from 'firebase-functions/logger';

jest.mock('firebase-functions/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('sendAlert', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete process.env.ALERT_WEBHOOK_URL;
  });

  it('should skip alert and log a warning if URL is not set', async () => {
    await sendAlert('Test Title', 'Test Message');
    expect(logger.warn).toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should send a POST request if ALERT_WEBHOOK_URL is set', async () => {
    process.env.ALERT_WEBHOOK_URL = 'http://test-webhook';
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    await sendAlert('Test Title', 'Test Message', '123');

    expect(global.fetch).toHaveBeenCalledWith('http://test-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Title',
        message: 'Test Message',
        fileId: '123'
      }),
    });
  });

  it('should log an error if the request fails', async () => {
    process.env.ALERT_WEBHOOK_URL = 'http://test-webhook';
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    });

    await sendAlert('Test Title', 'Test Message');

    expect(logger.error).toHaveBeenCalledWith('Failed to send alert', {
      status: 500,
      statusText: 'Internal Server Error'
    });
  });

  it('should log an error if fetch throws', async () => {
    process.env.ALERT_WEBHOOK_URL = 'http://test-webhook';
    const error = new Error('Network error');
    (global.fetch as jest.Mock).mockRejectedValue(error);

    await sendAlert('Test Title', 'Test Message');

    expect(logger.error).toHaveBeenCalledWith('Error sending alert', { error });
  });
});
