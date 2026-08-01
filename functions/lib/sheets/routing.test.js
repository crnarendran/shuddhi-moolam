"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const routing_1 = require("./routing");
jest.mock('googleapis', () => {
    return {
        google: {
            auth: {
                GoogleAuth: jest.fn(),
            },
            sheets: jest.fn().mockReturnValue({
                spreadsheets: {
                    get: jest.fn(),
                    batchUpdate: jest.fn(),
                    values: {
                        update: jest.fn(),
                    },
                },
            }),
        },
    };
});
describe('Sheets Routing Logic', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.MASTER_SHEET_ID = 'test-sheet-id';
    });
    afterEach(() => {
        delete process.env.MASTER_SHEET_ID;
    });
    it('should throw if MASTER_SHEET_ID is missing', async () => {
        delete process.env.MASTER_SHEET_ID;
        await expect((0, routing_1.ensureYearTab)(2026)).rejects.toThrow('MASTER_SHEET_ID environment variable not set.');
    });
    it('should reuse existing tab if found', async () => {
        routing_1.sheetsClient.spreadsheets.get.mockResolvedValueOnce({
            data: {
                sheets: [{ properties: { title: 'Data_2026' } }],
            },
        });
        const title = await (0, routing_1.ensureYearTab)(2026);
        expect(title).toBe('Data_2026');
        expect(routing_1.sheetsClient.spreadsheets.get).toHaveBeenCalledWith({
            spreadsheetId: 'test-sheet-id',
        });
        expect(routing_1.sheetsClient.spreadsheets.batchUpdate).not.toHaveBeenCalled();
        expect(routing_1.sheetsClient.spreadsheets.values.update).not.toHaveBeenCalled();
    });
    it('should create tab and insert headers if missing', async () => {
        routing_1.sheetsClient.spreadsheets.get.mockResolvedValueOnce({
            data: {
                sheets: [{ properties: { title: 'Data_2025' } }], // Different year
            },
        });
        routing_1.sheetsClient.spreadsheets.batchUpdate.mockResolvedValueOnce({});
        routing_1.sheetsClient.spreadsheets.values.update.mockResolvedValueOnce({});
        const title = await (0, routing_1.ensureYearTab)(2026);
        expect(title).toBe('Data_2026');
        expect(routing_1.sheetsClient.spreadsheets.batchUpdate).toHaveBeenCalledWith({
            spreadsheetId: 'test-sheet-id',
            requestBody: expect.objectContaining({
                requests: [
                    { addSheet: { properties: { title: 'Data_2026' } } },
                ],
            }),
        });
        expect(routing_1.sheetsClient.spreadsheets.values.update).toHaveBeenCalledWith({
            spreadsheetId: 'test-sheet-id',
            range: 'Data_2026!A1',
            valueInputOption: 'USER_ENTERED',
            requestBody: expect.objectContaining({
                values: expect.any(Array),
            }),
        });
    });
});
//# sourceMappingURL=routing.test.js.map