import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { Logger } from '@nestjs/common';

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
});
jest.mock('@aws-sdk/client-ses', () => ({
  SESClient: jest.fn().mockImplementation(() => ({
    send: jest.fn<Promise<any>, [any]>(),
  })),
  SendEmailCommand: jest.fn(),
}));

describe('MailService', () => {
  let mailService: MailService;
  let configService: ConfigService;
  let sesClient: jest.Mocked<SESClient>;

  const mockConfigService = {
    get: jest.fn((key: string): string => {
      const config = {
        AWS_REGION: 'us-east-1',
        AWS_ACCESS_KEY_ID: 'test-key',
        AWS_SECRET_ACCESS_KEY: 'test-secret',
        AWS_SESSION_TOKEN: 'test-token',
        SES_FROM_EMAIL: 'test@example.com',
        API_URL: 'http://localhost:3000',
      };
      return config[key as keyof typeof config] ?? '';
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    mailService = module.get<MailService>(MailService);
    configService = module.get<ConfigService>(ConfigService);
    sesClient = (mailService as any).sesClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize SES client when all config values are present', async () => {
      const tempModule = await Test.createTestingModule({
        providers: [
          MailService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();
      const service = tempModule.get<MailService>(MailService);

      expect((service as any).sesClient).toBeDefined();
      expect((service as any).canSendEmail).toBe(true);
    });

    it('should not initialize SES client when config values are missing', async () => {
      mockConfigService.get.mockImplementation((key: string): string => {
        if (key === 'AWS_REGION') return '';
        const config = { SES_FROM_EMAIL: 'test@example.com' };
        return config[key as keyof typeof config];
      });

      const moduleWithMissingConfig: TestingModule =
        await Test.createTestingModule({
          providers: [
            MailService,
            {
              provide: ConfigService,
              useValue: {
                get: jest.fn((key: string) => {
                  if (key === 'AWS_REGION') return undefined;
                  return {
                    AWS_ACCESS_KEY_ID: 'test-key',
                    AWS_SECRET_ACCESS_KEY: 'test-secret',
                    SES_FROM_EMAIL: 'test@example.com',
                    API_URL: 'http://localhost:3000',
                  }[key];
                }),
              },
            },
          ],
        }).compile();

      const serviceWithMissingConfig =
        moduleWithMissingConfig.get<MailService>(MailService);
      expect((serviceWithMissingConfig as any).sesClient).toBeUndefined();
      expect((serviceWithMissingConfig as any).canSendEmail).toBe(false);
      mockConfigService.get.mockImplementation((key: string) => {
        const config = {
          AWS_REGION: 'us-east-1',
          AWS_ACCESS_KEY_ID: 'test-key',
          AWS_SECRET_ACCESS_KEY: 'test-secret',
          AWS_SESSION_TOKEN: 'test-token',
          SES_FROM_EMAIL: 'test@example.com',
          API_URL: 'http://localhost:3000',
        };
        return config[key as keyof typeof config];
      });
    });
  });

  describe('sendEmailVerification', () => {
    it('should send verification email successfully', async () => {
      const user = 'testUser';
      const email = 'test@example.com';
      const token = 'verification-token';

      (sesClient.send as jest.Mock).mockResolvedValueOnce({});

      await mailService.sendEmailVerification(user, email, token);

      expect(SendEmailCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Destination: { ToAddresses: [email] },
          Source: 'test@example.com',
        }),
      );
      expect(sesClient.send).toHaveBeenCalledTimes(1);
    });

    it('should handle email sending failure', async () => {
      const user = 'testUser';
      const email = 'test@example.com';
      const token = 'verification-token';

      (sesClient.send as jest.Mock).mockRejectedValueOnce(
        new Error('Send failed'),
      );

      await mailService.sendEmailVerification(user, email, token);

      expect(sesClient.send).toHaveBeenCalledTimes(1);
    });
  });
});
