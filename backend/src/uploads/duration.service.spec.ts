import * as http from 'http';
import { DurationService } from './duration.service';
import * as mm from 'music-metadata';

jest.mock(
  'music-metadata',
  () => ({
    parseBuffer: jest.fn(),
  }),
  { virtual: true },
);

describe('DurationService', () => {
  it('calculates credits for play', () => {
    const service = new DurationService();
    expect(service.calculateCreditsForPlay(5)).toBe(1);
    expect(service.calculateCreditsForPlay(7)).toBe(2);
  });

  it('extracts duration from metadata', async () => {
    (mm.parseBuffer as jest.Mock).mockResolvedValue({
      format: { duration: 180.2 },
    });

    const service = new DurationService();
    const duration = await service.extractDuration(Buffer.from('test'));

    expect(duration).toBe(181);
  });

  it('returns null when video duration cannot be parsed', async () => {
    (mm.parseBuffer as jest.Mock).mockRejectedValue(new Error('no parser'));

    const service = new DurationService();
    await expect(
      service.extractDurationOrNull(Buffer.from('test'), 'video/mp4'),
    ).resolves.toBeNull();
  });

  it('falls back to 180 for song path when duration is unknown', async () => {
    (mm.parseBuffer as jest.Mock).mockRejectedValue(new Error('no parser'));

    const service = new DurationService();
    await expect(service.extractDuration(Buffer.from('test'))).resolves.toBe(
      180,
    );
  });

  describe('probeRemoteDurationSeconds', () => {
    const box = (type: string, body: Buffer): Buffer => {
      const header = Buffer.alloc(8);
      header.writeUInt32BE(body.length + 8, 0);
      header.write(type, 4, 'latin1');
      return Buffer.concat([header, body]);
    };

    /** mvhd v0: version+flags, times, timescale, duration, then trailing fields. */
    const mvhd = (timescale: number, duration: number): Buffer => {
      const body = Buffer.alloc(100);
      body.writeUInt8(0, 0);
      body.writeUInt32BE(0, 4);
      body.writeUInt32BE(0, 8);
      body.writeUInt32BE(timescale, 12);
      body.writeUInt32BE(duration, 16);
      return box('mvhd', body);
    };

    let server: http.Server;
    let requestedRanges: string[];
    let payload: Buffer;

    const startServer = async (buffer: Buffer): Promise<string> => {
      payload = buffer;
      requestedRanges = [];
      server = http.createServer((req, res) => {
        const range = req.headers.range ?? '';
        requestedRanges.push(range);
        const match = /bytes=(\d+)-(\d+)/.exec(range);
        if (!match) {
          res.writeHead(200, { 'content-length': String(payload.length) });
          res.end(payload);
          return;
        }
        const start = Number(match[1]);
        const end = Math.min(Number(match[2]), payload.length - 1);
        const slice = payload.subarray(start, end + 1);
        res.writeHead(206, {
          'content-length': String(slice.length),
          'content-range': `bytes ${start}-${end}/${payload.length}`,
        });
        res.end(slice);
      });
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      return `http://127.0.0.1:${port}/clip.mov`;
    };

    afterEach(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it('reads duration when moov sits after a huge mdat', async () => {
      // Phone recordings put moov at the end. A head slice finds nothing here,
      // which is exactly the case this probe exists for.
      const mdat = box('mdat', Buffer.alloc(4 * 1024 * 1024));
      const file = Buffer.concat([
        box('ftyp', Buffer.from('qt  ', 'latin1')),
        mdat,
        box('moov', mvhd(600, 600 * 42)),
      ]);
      const url = await startServer(file);

      const service = new DurationService();
      const seconds = await service.probeRemoteDurationSeconds(url, {
        mimeType: 'video/quicktime',
        sizeBytes: file.length,
      });

      expect(seconds).toBe(42);
      // The 4MB mdat must never be pulled down just to read a timestamp.
      const bytesFetched = requestedRanges.reduce((total, range) => {
        const match = /bytes=(\d+)-(\d+)/.exec(range);
        if (!match) return total + payload.length;
        return total + (Number(match[2]) - Number(match[1]) + 1);
      }, 0);
      expect(bytesFetched).toBeLessThan(mdat.length);
    });

    it('reads duration from a 64-bit mvhd', async () => {
      const body = Buffer.alloc(112);
      body.writeUInt8(1, 0);
      body.writeUInt32BE(1000, 20);
      body.writeBigUInt64BE(BigInt(1000 * 90), 24);
      const file = Buffer.concat([
        box('ftyp', Buffer.from('isom', 'latin1')),
        box('moov', box('mvhd', body)),
      ]);
      const url = await startServer(file);

      const service = new DurationService();
      await expect(
        service.probeRemoteDurationSeconds(url, {
          mimeType: 'video/mp4',
          sizeBytes: file.length,
        }),
      ).resolves.toBe(90);
    });

    it('returns null when no moov box exists', async () => {
      (mm.parseBuffer as jest.Mock).mockRejectedValue(new Error('no parser'));
      const file = Buffer.concat([
        box('ftyp', Buffer.from('isom', 'latin1')),
        box('mdat', Buffer.alloc(64)),
      ]);
      const url = await startServer(file);

      const service = new DurationService();
      await expect(
        service.probeRemoteDurationSeconds(url, {
          mimeType: 'video/mp4',
          sizeBytes: file.length,
        }),
      ).resolves.toBeNull();
    });
  });
});
