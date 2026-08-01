"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const watch_1 = require("./watch");
const googleapis_1 = require("googleapis");
const firestore_1 = require("firebase-admin/firestore");
jest.mock('googleapis', () => {
    const watchMock = jest.fn();
    const getStartPageTokenMock = jest.fn();
    const stopMock = jest.fn();
    return {
        google: {
            auth: {
                GoogleAuth: jest.fn(),
            },
            drive: jest.fn(() => ({
                changes: {
                    watch: watchMock,
                    getStartPageToken: getStartPageTokenMock,
                },
                channels: {
                    stop: stopMock,
                },
            })),
        },
    };
});
jest.mock('firebase-admin/firestore', () => {
    const setMock = jest.fn();
    const getMock = jest.fn();
    const docMock = jest.fn(() => ({
        set: setMock,
        get: getMock,
    }));
    return {
        getFirestore: jest.fn(() => ({
            doc: docMock,
        })),
    };
});
describe('Drive Watch Logic', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    it('should start a drive watch and save state to firestore', async () => {
        const d = googleapis_1.google.drive({ version: 'v3' });
        d.changes.getStartPageToken.mockResolvedValue({
            data: { startPageToken: 'token_123' },
        });
        d.changes.watch.mockResolvedValue({
            data: {
                id: 'mock_channel_id',
                resourceId: 'mock_resource_id',
                expiration: '1234567890',
            },
        });
        const db = (0, firestore_1.getFirestore)();
        const docRef = db.doc('test'); // mock doc returns the chained functions
        const state = await (0, watch_1.startDriveWatch)('https://example.com/webhook');
        expect(state.channelId).toBe('mock_channel_id');
        expect(state.resourceId).toBe('mock_resource_id');
        expect(state.expiration).toBe(1234567890);
        expect(state.webhookUrl).toBe('https://example.com/webhook');
        expect(d.changes.getStartPageToken).toHaveBeenCalled();
        expect(d.changes.watch).toHaveBeenCalledWith(expect.objectContaining({
            pageToken: 'token_123',
        }));
        expect(docRef.set).toHaveBeenCalledWith(state);
    });
    it('should stop a drive watch', async () => {
        const d = googleapis_1.google.drive({ version: 'v3' });
        await (0, watch_1.stopDriveWatch)('chan1', 'res1');
        expect(d.channels.stop).toHaveBeenCalledWith({
            requestBody: {
                id: 'chan1',
                resourceId: 'res1',
            },
        });
    });
    it('should retrieve watch state', async () => {
        const db = (0, firestore_1.getFirestore)();
        const docRef = db.doc('test');
        docRef.get.mockResolvedValue({
            exists: true,
            data: () => ({ channelId: 'chan2', resourceId: 'res2', expiration: 999, webhookUrl: 'http://test' }),
        });
        const state = await (0, watch_1.getWatchState)();
        expect(state).toEqual({ channelId: 'chan2', resourceId: 'res2', expiration: 999, webhookUrl: 'http://test' });
    });
});
//# sourceMappingURL=watch.test.js.map