"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const download_1 = require("./download");
const watch_1 = require("./watch");
jest.mock('./watch', () => ({
    drive: {
        files: {
            get: jest.fn(),
        },
    },
}));
describe('Download PDF logic', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    it('should reject a non-pdf file', async () => {
        watch_1.drive.files.get.mockResolvedValueOnce({
            data: { mimeType: 'text/plain', size: '100' },
        });
        await expect((0, download_1.downloadPdf)('f1')).rejects.toThrow(/Invalid mimeType/);
        expect(watch_1.drive.files.get).toHaveBeenCalledTimes(1); // metadata check only
    });
    it('should reject a file that is too large', async () => {
        watch_1.drive.files.get.mockResolvedValueOnce({
            data: { mimeType: 'application/pdf', size: '999999999' },
        });
        await expect((0, download_1.downloadPdf)('f2')).rejects.toThrow(/File too large/);
        expect(watch_1.drive.files.get).toHaveBeenCalledTimes(1); // metadata check only
    });
    it('should download and return a Buffer for a valid PDF', async () => {
        watch_1.drive.files.get
            .mockResolvedValueOnce({
            data: { mimeType: 'application/pdf', size: '1024' },
        })
            .mockResolvedValueOnce({
            data: new ArrayBuffer(8),
        });
        const buf = await (0, download_1.downloadPdf)('f3');
        expect(buf).toBeInstanceOf(Buffer);
        expect(buf.length).toBe(8);
        expect(watch_1.drive.files.get).toHaveBeenCalledTimes(2);
        expect(watch_1.drive.files.get).toHaveBeenLastCalledWith({ fileId: 'f3', alt: 'media' }, { responseType: 'arraybuffer' });
    });
});
//# sourceMappingURL=download.test.js.map