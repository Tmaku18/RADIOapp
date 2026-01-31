import { BadRequestException } from '@nestjs/common';
import { UploadsService } from './uploads.service';

describe('UploadsService', () => {
  it('rejects invalid content type for signed upload', async () => {
    const configService = { get: jest.fn() };
    const service = new UploadsService(configService as any);

    await expect(
      service.getSignedUploadUrl('user', 'songs', 'track.txt', 'text/plain'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
