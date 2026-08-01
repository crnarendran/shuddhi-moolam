import { downloadPdf } from './download';
import { drive } from './watch';

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
    (drive.files.get as jest.Mock).mockResolvedValueOnce({
      data: { mimeType: 'text/plain', size: '100' },
    });

    await expect(downloadPdf('f1')).rejects.toThrow(/Invalid mimeType/);
    expect(drive.files.get).toHaveBeenCalledTimes(1); // metadata check only
  });

  it('should reject a file that is too large', async () => {
    (drive.files.get as jest.Mock).mockResolvedValueOnce({
      data: { mimeType: 'application/pdf', size: '999999999' },
    });

    await expect(downloadPdf('f2')).rejects.toThrow(/File too large/);
    expect(drive.files.get).toHaveBeenCalledTimes(1); // metadata check only
  });

  it('should download and return a Buffer for a valid PDF', async () => {
    (drive.files.get as jest.Mock)
      .mockResolvedValueOnce({
        data: { mimeType: 'application/pdf', size: '1024' },
      })
      .mockResolvedValueOnce({
        data: new ArrayBuffer(8),
      });

    const buf = await downloadPdf('f3');

    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBe(8);
    expect(drive.files.get).toHaveBeenCalledTimes(2);
    expect(drive.files.get).toHaveBeenLastCalledWith(
      { fileId: 'f3', alt: 'media' },
      { responseType: 'arraybuffer' }
    );
  });
});
