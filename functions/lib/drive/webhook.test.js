"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const webhook_1 = require("./webhook");
const watch_1 = require("./watch");
const firestore_1 = require("firebase-admin/firestore");
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
    let req;
    let res;
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
        req.headers = {};
        await (0, webhook_1.driveWebhook)(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });
    it('should reject mismatched channel state', async () => {
        watch_1.getWatchState.mockResolvedValue({
            channelId: 'chan2',
            resourceId: 'res2',
        });
        await (0, webhook_1.driveWebhook)(req, res);
        expect(res.status).toHaveBeenCalledWith(403);
    });
    it('should return 200 on sync state', async () => {
        watch_1.getWatchState.mockResolvedValue({
            channelId: 'chan1',
            resourceId: 'res1',
        });
        req
            .headers['x-goog-resource-state'] = 'sync';
        await (0, webhook_1.driveWebhook)(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
    });
    it('should process changes and enqueue valid PDFs', async () => {
        watch_1.getWatchState.mockResolvedValue({
            channelId: 'chan1',
            resourceId: 'res1',
            pageToken: 'token1',
        });
        watch_1.drive.changes.list.mockResolvedValue({
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
        watch_1.drive.files.get.mockResolvedValue({
            data: { parents: ['1RgArYZYgmR-ZJB7Gne5fZA7nlufIKaeb'] },
        });
        const db = (0, firestore_1.getFirestore)();
        const docRef = db.doc('test');
        docRef.get.mockResolvedValue({ exists: false });
        await (0, webhook_1.driveWebhook)(req, res);
        expect(watch_1.drive.changes.list).toHaveBeenCalledWith({
            pageToken: 'token1',
            spaces: 'drive',
        });
        expect(docRef.set).toHaveBeenCalledWith(expect.objectContaining({
            fileId: 'file1',
        }));
        expect(watch_1.updatePageToken).toHaveBeenCalledWith('token2');
        expect(res.status).toHaveBeenCalledWith(200);
    });
});
//# sourceMappingURL=webhook.test.js.map