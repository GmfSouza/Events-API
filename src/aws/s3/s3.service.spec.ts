import { S3Service } from './s3.service';
import { InternalServerErrorException } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

jest.mock('@aws-sdk/client-s3');
jest.mock('uuid', () => ({ v4: () => 'uuid' }));

const mockConfig = {
  get: jest.fn((key: string, fallback?: string) => {
    const env = {
      AWS_REGION: 'us-east-1',
      S3_BUCKET_NAME: 'bucket',
      S3_PROFILE_IMAGE_PATH: 'user-profiles/',
      S3_EVENT_IMAGE_PATH: 'events-images/',
      AWS_ACCESS_KEY_ID: 'key',
      AWS_SECRET_ACCESS_KEY: 'secret',
      AWS_SESSION_TOKEN: 'token',
    };
    return env[key] ?? fallback;
  }),
};

const mockFile = {
  originalname: 'file.png',
  buffer: Buffer.from('test'),
  mimetype: 'image/png',
};

describe('S3Service', () => {
  let service: S3Service;
  let s3ClientSendMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    (S3Client as any).mockClear();
    s3ClientSendMock = jest.fn();
    (S3Client as any).mockImplementation(() => ({
      send: s3ClientSendMock,
    }));
    service = new S3Service(mockConfig as any);
  });

  describe('constructor', () => {
    it('should throw if AWS_REGION or S3_BUCKET_NAME is missing', () => {
      const badConfig = {
        get: jest.fn((key: string) => {
          if (key === 'AWS_REGION') return undefined;
          if (key === 'S3_BUCKET_NAME') return undefined;
          return 'x';
        }),
      };
      expect(() => new S3Service(badConfig as any)).toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('uploadFile', () => {
    it('should upload file to user-profiles path', async () => {
      s3ClientSendMock.mockResolvedValueOnce({ ETag: 'etag' });
      const result = await service.uploadFile(
        mockFile as any,
        'user-profiles',
        '123',
      );
      expect(s3ClientSendMock).toHaveBeenCalledWith(
        expect.any(PutObjectCommand),
      );
      expect(result.Location).toContain('user-profiles/123/uuid.png');
      expect(result.Key).toBe('user-profiles/123/uuid.png');
      expect(result.Bucket).toBe('bucket');
      expect(result.ETag).toBe('etag');
    });

    it('should upload file to events-images path', async () => {
      s3ClientSendMock.mockResolvedValueOnce({ ETag: 'etag' });
      const result = await service.uploadFile(
        mockFile as any,
        'event-images',
        '456',
      );
      expect(result.Key).toBe('events-images/456/uuid.png');
    });

    it('should upload file to custom path', async () => {
      s3ClientSendMock.mockResolvedValueOnce({ ETag: 'etag' });
      const result = await service.uploadFile(
        mockFile as any,
        'custom-path',
        '789',
      );
      expect(result.Key).toBe('custom-path/789/uuid.png');
    });

    it('should upload file to custom path with trailing slash', async () => {
      s3ClientSendMock.mockResolvedValueOnce({ ETag: 'etag' });
      const result = await service.uploadFile(
        mockFile as any,
        'custom-path/',
        '789',
      );
      expect(result.Key).toBe('custom-path/789/uuid.png');
    });

    it('should throw InternalServerErrorException on upload error', async () => {
      s3ClientSendMock.mockRejectedValueOnce(new Error('fail'));
      await expect(
        service.uploadFile(mockFile as any, 'user-profiles', '123'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      s3ClientSendMock.mockResolvedValueOnce({});
      await expect(
        service.deleteFile('user-profiles/123/uuid.png'),
      ).resolves.toBeUndefined();
      expect(s3ClientSendMock).toHaveBeenCalledWith(
        expect.any(DeleteObjectCommand),
      );
    });

    it('should throw InternalServerErrorException on delete error', async () => {
      s3ClientSendMock.mockRejectedValueOnce(new Error('fail'));
      await expect(
        service.deleteFile('user-profiles/123/uuid.png'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});
