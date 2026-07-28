import { BadRequestException } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { getSupabaseClient } from '../config/supabase.config';
import { createSupabaseMock } from '../test-utils/supabase-mock';

jest.mock('../config/supabase.config', () => ({
  getSupabaseClient: jest.fn(),
}));

const createImageModerationMock = () =>
  ({
    assertImageBufferAllowed: jest.fn().mockResolvedValue(undefined),
    assertImageUrlAllowed: jest.fn().mockResolvedValue(undefined),
  }) as any;

const makeFile = (
  overrides: Partial<Express.Multer.File> & {
    mimetype: string;
    size?: number;
  },
): Express.Multer.File =>
  ({
    fieldname: 'file',
    originalname: 'file.bin',
    encoding: '7bit',
    buffer: Buffer.from('test'),
    size: overrides.size ?? 1024,
    ...overrides,
  }) as Express.Multer.File;

describe('UploadsService', () => {
  const configService = {
    get: jest.fn((key: string) =>
      key === 'SUPABASE_URL' ? 'https://supabase.example' : undefined,
    ),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getSupabaseClient as jest.Mock).mockReturnValue(createSupabaseMock());
  });

  describe('getSignedUploadUrl', () => {
    it('rejects invalid content type for songs bucket', async () => {
      const service = new UploadsService(
        configService as any,
        createImageModerationMock(),
      );

      await expect(
        service.getSignedUploadUrl('user', 'songs', 'track.txt', 'text/plain'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects invalid content type for artwork bucket', async () => {
      const service = new UploadsService(
        configService as any,
        createImageModerationMock(),
      );

      await expect(
        service.getSignedUploadUrl(
          'user',
          'artwork',
          'track.mp3',
          'audio/mpeg',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it.each([
      ['songs', 'track.mp3', 'audio/mpeg'],
      ['songs', 'track.m4a', 'audio/mp4'],
      ['songs', 'track.wav', 'audio/wav'],
      ['artwork', 'cover.jpg', 'image/jpeg'],
      ['artwork', 'cover.png', 'image/png'],
      ['artwork', 'cover.webp', 'image/webp'],
      ['portfolio', 'demo.mp3', 'audio/mpeg'],
      ['portfolio', 'shot.mp4', 'video/mp4'],
      ['portfolio', 'shot.jpg', 'image/jpeg'],
    ] as const)(
      'accepts %s / %s (%s)',
      async (bucket, filename, contentType) => {
        const service = new UploadsService(
          configService as any,
          createImageModerationMock(),
        );

        const result = await service.getSignedUploadUrl(
          'user-1',
          bucket,
          filename,
          contentType,
        );

        expect(result.signedUrl).toContain('https://');
        expect(result.path).toContain('user-1/');
        expect(result.expiresIn).toBe(60);
      },
    );
  });

  describe('multipart validators', () => {
    it('rejects missing song file', async () => {
      const service = new UploadsService(
        configService as any,
        createImageModerationMock(),
      );
      await expect(
        service.uploadAudioFile(undefined as any, 'user-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects invalid song mime type', async () => {
      const service = new UploadsService(
        configService as any,
        createImageModerationMock(),
      );
      await expect(
        service.uploadAudioFile(
          makeFile({ mimetype: 'text/plain', originalname: 'a.txt' }),
          'user-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('uploads valid song audio', async () => {
      const service = new UploadsService(
        configService as any,
        createImageModerationMock(),
      );
      const url = await service.uploadAudioFile(
        makeFile({
          mimetype: 'audio/mpeg',
          originalname: 'track.mp3',
        }),
        'user-1',
      );
      expect(url).toContain('https://example.com');
    });

    it('uploads valid artwork after image moderation', async () => {
      const moderation = createImageModerationMock();
      const service = new UploadsService(configService as any, moderation);
      const url = await service.uploadArtworkFile(
        makeFile({
          mimetype: 'image/jpeg',
          originalname: 'cover.jpg',
        }),
        'user-1',
      );
      expect(moderation.assertImageBufferAllowed).toHaveBeenCalled();
      expect(url).toContain('https://example.com');
    });

    it('uploads valid avatar image', async () => {
      const service = new UploadsService(
        configService as any,
        createImageModerationMock(),
      );
      const url = await service.uploadProfileImage(
        makeFile({
          mimetype: 'image/png',
          originalname: 'avatar.png',
        }),
        'user-1',
      );
      expect(url).toContain('https://example.com');
    });

    it('uploads valid feed image and video types', async () => {
      const service = new UploadsService(
        configService as any,
        createImageModerationMock(),
      );
      await expect(
        service.uploadFeedPostMedia(
          makeFile({ mimetype: 'image/jpeg', originalname: 'post.jpg' }),
          'user-1',
        ),
      ).resolves.toContain('https://example.com');
      await expect(
        service.uploadFeedPostMedia(
          makeFile({ mimetype: 'video/mp4', originalname: 'clip.mp4' }),
          'user-1',
        ),
      ).resolves.toContain('https://example.com');
    });

    it('rejects oversized feed media', async () => {
      const service = new UploadsService(
        configService as any,
        createImageModerationMock(),
      );
      await expect(
        service.uploadFeedPostMedia(
          makeFile({
            mimetype: 'video/mp4',
            originalname: 'huge.mp4',
            size: 1025 * 1024 * 1024,
          }),
          'user-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('uploads hero / cover image', async () => {
      const service = new UploadsService(
        configService as any,
        createImageModerationMock(),
      );
      await expect(
        service.uploadHeroImage(
          makeFile({ mimetype: 'image/webp', originalname: 'hero.webp' }),
          'user-1',
        ),
      ).resolves.toContain('https://example.com');
    });

    it('rejects non-PDF resume', async () => {
      const service = new UploadsService(
        configService as any,
        createImageModerationMock(),
      );
      await expect(
        service.uploadResume(
          makeFile({ mimetype: 'image/png', originalname: 'resume.png' }),
          'user-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('uploads PDF resume and returns signed url', async () => {
      const service = new UploadsService(
        configService as any,
        createImageModerationMock(),
      );
      const result = await service.uploadResume(
        makeFile({
          mimetype: 'application/pdf',
          originalname: 'resume.pdf',
        }),
        'user-1',
      );
      expect(result.path).toBeTruthy();
      expect(result.signedUrl).toContain('https://');
    });

    it('rejects oversized resume', async () => {
      const service = new UploadsService(
        configService as any,
        createImageModerationMock(),
      );
      await expect(
        service.uploadResume(
          makeFile({
            mimetype: 'application/pdf',
            originalname: 'resume.pdf',
            size: 11 * 1024 * 1024,
          }),
          'user-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
