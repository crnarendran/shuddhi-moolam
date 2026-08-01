import { driveWebhook } from './webhook';
import { getWatchState, updatePageToken, drive } from './watch';
import { getFirestore } from 'firebase-admin/firestore';
import { Request } from 'firebase-functions/v2/https';
import * as express from 'express';

jest.mock('./watch', () => ({
  getWatchState: jest.fn(),
  updatePageToken: jest.fn(),
  drive: {
    changes: {
      list: jest.fn(),
    },
    files: {
      get: jest.fn(),
    },
  },
}));

jest.mock('firebase-admin/firestore', () => {
  const getMock = jest.fn();
  const setMock = jest.fn();
  const docMock = jest.fn(() => ({
    get: getMock,
    set: setMock,
  }));
  return {
    getFirestore: jest.fn(() => ({
      doc: docMock,
    })),
  };
});

describe('Drive Webhook', () => {
  let req: unknown;
  let res: unknown;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      headers: {
        'x-goog-channel-id': 'chan1',
        'x-goog-resource-id': 'res1',
        'x-goog-resource-state': 'update',
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
  });

  it('should reject missing headers', async () => {
    (req as { headers: Record<string, string> }).headers = {};
    await driveWebhook(req as Request, res as express.Response);
    expect((res as { status: jest.Mock }).status).toHaveBeenCalledWith(400);
  });

  it('should reject mismatched channel state', async () => {
    (getWatchState as jest.Mock).mockResolvedValue({
      channelId: 'chan2',
      resourceId: 'res2',
    });
    await driveWebhook(req as Request, res as express.Response);
    expect((res as { status: jest.Mock }).status).toHaveBeenCalledWith(403);
  });

  it('should return 200 on sync state', async () => {
    (getWatchState as jest.Mock).mockResolvedValue({
      channelId: 'chan1',
      resourceId: 'res1',
    });
    (req as { headers: Record<string, string> })
      .headers['x-goog-resource-state'] = 'sync';
    await driveWebhook(req as Request, res as express.Response);
    expect((res as { status: jest.Mock }).status).toHaveBeenCalledWith(200);
  });

  it('should process changes and enqueue valid PDFs', async () => {
    (getWatchState as jest.Mock).mockResolvedValue({
      channelId: 'chan1',
      resourceId: 'res1',
      pageToken: 'token1',
    });

    (drive.changes.list as jest.Mock).mockResolvedValue({
      data: {
        newStartPageToken: 'token2',
        changes: [
          {
            fileId: 'file1',
            file: { mimeType: 'application/pdf', trashed: false },
            removed: false,
          },
        ],
      },
    });

    (drive.files.get as jest.Mock).mockResolvedValue({
      data: { parents: ['1RgArYZYgmR-ZJB7Gne5fZA7nlufIKaeb'] },
    });

    const db = getFirestore();
    const docRef = db.doc('test');
    (docRef.get as jest.Mock).mockResolvedValue({ exists: false });

    await driveWebhook(req as Request, res as express.Response);

    expect(drive.changes.list).toHaveBeenCalledWith({
      pageToken: 'token1',
      spaces: 'drive',
    });
    expect(docRef.set).toHaveBeenCalledWith(expect.objectContaining({
      fileId: 'file1',
      status: 'detected',
      attempts: 0,
    }));
    expect(updatePageToken).toHaveBeenCalledWith('token2');
    expect((res as { status: jest.Mock }).status).toHaveBeenCalledWith(200);
  });
});
