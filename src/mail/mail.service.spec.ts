import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import { SESClient, SendEmailCommand, SendRawEmailCommand } from '@aws-sdk/client-ses';
import { Logger } from '@nestjs/common';

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
});

jest.mock('@aws-sdk/client-ses', () => ({
  SESClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  SendEmailCommand: jest.fn(),
  SendRawEmailCommand: jest.fn(),
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
    mockConfigService.get.mockImplementation((key: string): string => {
      const config = {
        AWS_REGION: 'us-east-1',
        AWS_ACCESS_KEY_ID: 'test-key',
        AWS_SECRET_ACCESS_KEY: 'test-secret',
        AWS_SESSION_TOKEN: 'test-token',
        SES_FROM_EMAIL: 'test@example.com',
        API_URL: 'http://localhost:3000',
      };
      return config[key as keyof typeof config] ?? '';
    });
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

  describe('sendDeletedAccountNotification', () => {
    it('should send account deletion notification successfully', async () => {
      const user = 'testUser';
      const email = 'test@example.com';
      (sesClient.send as jest.Mock).mockResolvedValueOnce({});
      await mailService.sendDeletedAccountNotification(user, email);
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
      (sesClient.send as jest.Mock).mockRejectedValueOnce(
        new Error('Deletion notification failed'),
      );
      await mailService.sendDeletedAccountNotification(user, email);
      expect(sesClient.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendCreatedEventEmail', () => {
    const testParams = {
      organizerEmail: 'organizer@example.com',
      organizerName: 'John Doe',
      eventName: 'Test Event',
      eventDate: '2024-01-01T10:00:00Z',
      eventId: 'event123',
    };

    it('should send created event email successfully', async () => {
      const spyLogger = jest.spyOn(Logger.prototype, 'log');

      await mailService.sendCreatedEventEmail(
        testParams.organizerEmail,
        testParams.organizerName,
        testParams.eventName,
        testParams.eventDate,
        testParams.eventId,
      );

      expect(SendEmailCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Destination: {
            ToAddresses: [testParams.organizerEmail],
          },
          Message: {
            Subject: {
              Data: 'Event Created Successfully',
              charset: 'UTF-8',
            },
            Body: {
              Html: {
                Data: expect.stringContaining(testParams.eventName),
                charset: 'UTF-8',
              },
              Text: {
                Data: expect.stringContaining(testParams.eventName),
                charset: 'UTF-8',
              },
            },
          },
          Source: 'test@example.com',
        }),
      );

      expect(spyLogger).toHaveBeenCalledWith(
        `Email sent to ${testParams.organizerEmail}`,
      );
    });

    it('should handle disabled email sending when configuration is missing', async () => {
      const spyLogger = jest.spyOn(Logger.prototype, 'warn');
      jest.spyOn(configService, 'get').mockImplementation(() => undefined);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MailService,
          {
            provide: ConfigService,
            useValue: { get: () => undefined },
          },
        ],
      }).compile();

      const disabledMailService = module.get<MailService>(MailService);

      await disabledMailService.sendCreatedEventEmail(
        testParams.organizerEmail,
        testParams.organizerName,
        testParams.eventName,
        testParams.eventDate,
        testParams.eventId,
      );

      expect(spyLogger).toHaveBeenCalledWith(
        'Email sending is disabled due to missing SES configuration.',
      );
    });
  });

  describe('MailService - sendEventDeletedEmail', () => {
    let sesClient: any;
    const testParams = {
      organizerEmail: 'organizer@example.com',
      organizerName: 'John Doe',
      eventName: 'Test Event',
    };

    it('should successfully send event deleted email', async () => {
      if (!sesClient) {
        sesClient = { send: jest.fn() } as any;
        (mailService as any).sesClient = sesClient;
      }
      (sesClient.send as jest.Mock).mockResolvedValueOnce({});
      const spyLogger = jest.spyOn(Logger.prototype, 'log');

      await mailService.sendEventDeletedEmail(
        testParams.organizerEmail,
        testParams.organizerName,
        testParams.eventName,
      );

      expect(SendEmailCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Destination: {
            ToAddresses: [testParams.organizerEmail],
          },
          Message: {
            Subject: {
              Data: 'Event Deleted',
              charset: 'UTF-8',
            },
            Body: {
              Html: {
                Data: expect.stringContaining(testParams.organizerName),
                charset: 'UTF-8',
              },
              Text: {
                Data: expect.stringContaining(testParams.organizerName),
                charset: 'UTF-8',
              },
            },
          },
          Source: 'test@example.com',
        }),
      );
      expect(spyLogger).toHaveBeenCalledWith(
        `Email sent to ${testParams.organizerEmail}`,
      );
    });

    it('should handle email sending failure gracefully', async () => {
      sesClient = (mailService as any).sesClient;
      if (!sesClient) {
        sesClient = { send: jest.fn() } as any;
        (mailService as any).sesClient = sesClient;
      }
      const error = new Error('SES send error');
      (sesClient.send as jest.Mock).mockRejectedValueOnce(error);
      const errorLoggerSpy = jest.spyOn(Logger.prototype, 'error');

      await mailService.sendEventDeletedEmail(
        testParams.organizerEmail,
        testParams.organizerName,
        testParams.eventName,
      );

      expect(sesClient.send).toHaveBeenCalledTimes(1);
      expect(errorLoggerSpy).toHaveBeenCalledWith(
        `Failed to send email to ${testParams.organizerEmail}:`,
        error,
      );
    });

    it('should not send email when email service is disabled', async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [
          MailService,
          {
            provide: ConfigService,
            useValue: {
              get: () => undefined,
            },
          },
        ],
      }).compile();

      const disabledMailService = moduleRef.get<MailService>(MailService);
      const warnLoggerSpy = jest.spyOn(Logger.prototype, 'warn');

      await disabledMailService.sendEventDeletedEmail(
        testParams.organizerEmail,
        testParams.organizerName,
        testParams.eventName,
      );

      expect(warnLoggerSpy).toHaveBeenCalledWith(
        'Email sending is disabled due to missing SES configuration.',
      );
      expect(SendEmailCommand).not.toHaveBeenCalled();
    });
  });

  describe('sendRegistrationNotification', () => {
    it('should send registration notification with ICS when calendar generation succeeds', async () => {
      const spySendEmailWithICS = jest
        .spyOn(mailService as any, 'sendEmailWithICS')
        .mockResolvedValue(undefined);
      const spyGenerateICalendarData = jest
        .spyOn(mailService as any, 'generateICalendarData')
        .mockReturnValue('ICS_DATA');

      await mailService.sendRegistrationNotification(
        'participant@example.com',
        'Participant',
        'Event Name',
        '2024-01-01T10:00:00Z',
        'Event Description',
        'event-123'
      );

      expect(spyGenerateICalendarData).toHaveBeenCalled();
      expect(spySendEmailWithICS).toHaveBeenCalledWith(
        'participant@example.com',
        expect.any(String),
        expect.any(String),
        expect.any(String),
        'ICS_DATA',
        'Event Name'
      );
    });

    it('should fallback to sendEmail if calendar generation fails', async () => {
      const spyGenerateICalendarData = jest
        .spyOn(mailService as any, 'generateICalendarData')
        .mockReturnValue(null);
      const spySendEmail = jest
        .spyOn(mailService as any, 'sendEmail')
        .mockResolvedValue(undefined);

      await mailService.sendRegistrationNotification(
        'participant@example.com',
        'Participant',
        'Event Name',
        '2024-01-01T10:00:00Z',
        'Event Description',
        'event-123'
      );

      expect(spyGenerateICalendarData).toHaveBeenCalled();
      expect(spySendEmail).toHaveBeenCalledWith(
        'participant@example.com',
        expect.any(String),
        expect.any(String),
        expect.any(String)
      );
    });

    it('should log error if calendar generation fails', async () => {
      const spyGenerateICalendarData = jest
        .spyOn(mailService as any, 'generateICalendarData')
        .mockReturnValue(null);
      const spyLogger = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
      const spySendEmail = jest
        .spyOn(mailService as any, 'sendEmail')
        .mockResolvedValue(undefined);

      await mailService.sendRegistrationNotification(
        'participant@example.com',
        'Participant',
        'Event Name',
        '2024-01-01T10:00:00Z',
        'Event Description',
        'event-123'
      );

      expect(spyLogger).toHaveBeenCalledWith(
        expect.stringContaining('Failed to generate iCalendar data'),
      );
      expect(spySendEmail).toHaveBeenCalled();
    });
  });

  describe('sendRegistrationCancellationNotification', () => {
    it('should send registration cancellation notification', async () => {
      const spySendEmail = jest
        .spyOn(mailService as any, 'sendEmail')
        .mockResolvedValue(undefined);

      await mailService.sendRegistrationCancellationNotification(
        'participant@example.com',
        'Participant',
        'Event Name'
      );

      expect(spySendEmail).toHaveBeenCalledWith(
        'participant@example.com',
        'Registration Cancellation',
        expect.stringContaining('Registration Cancellation'),
        expect.stringContaining('has been canceled')
      );
    });

    it('should log sending cancellation notification', async () => {
      const spyLogger = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
      jest.spyOn(mailService as any, 'sendEmail').mockResolvedValue(undefined);

      await mailService.sendRegistrationCancellationNotification(
        'participant@example.com',
        'Participant',
        'Event Name'
      );

      expect(spyLogger).toHaveBeenCalledWith(
        expect.stringContaining('Sending registration cancellation notification')
      );
    });
  });

  describe('sendEmailWithICS', () => {
    it('should send email with ICS attachment', async () => {
      (sesClient.send as jest.Mock).mockResolvedValueOnce({});
      const spyLogger = jest.spyOn(Logger.prototype, 'log');
      await (mailService as any).sendEmailWithICS(
        'to@example.com',
        'Subject',
        '<b>body</b>',
        'text',
        'ICS_DATA',
        'Event Name'
      );
      expect(SendRawEmailCommand).toHaveBeenCalled();
      expect(sesClient.send).toHaveBeenCalledTimes(1);
      expect(spyLogger).toHaveBeenCalledWith(
        expect.stringContaining('Email with ICS sent to to@example.com')
      );
    });

    it('should not send if SES is not configured', async () => {
      (mailService as any).canSendEmail = false;
      const spyLogger = jest.spyOn(Logger.prototype, 'warn');
      await (mailService as any).sendEmailWithICS(
        'to@example.com',
        'Subject',
        '<b>body</b>',
        'text',
        'ICS_DATA',
        'Event Name'
      );
      expect(spyLogger).toHaveBeenCalledWith(
        'Email sending is disabled due to missing SES configuration.'
      );
    });

    it('should log error if sending fails', async () => {
      (mailService as any).canSendEmail = true;
      (mailService as any).sesClient = sesClient;
      (sesClient.send as jest.Mock).mockRejectedValueOnce(new Error('fail'));
      const spyLogger = jest.spyOn(Logger.prototype, 'error');
      await (mailService as any).sendEmailWithICS(
        'to@example.com',
        'Subject',
        '<b>body</b>',
        'text',
        'ICS_DATA',
        'Event Name'
      );
      expect(spyLogger).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send email with ICS to to@example.com:'),
        expect.any(Error)
      );
    });
  });

  describe('generateICalendarData', () => {
    it('should generate valid ICS data', () => {
      const result = (mailService as any).generateICalendarData(
        'Event Name',
        '2025-01-01T10:00:00Z',
        'Description',
        'event-123'
      );
      expect(result).toContain('BEGIN:VCALENDAR');
      expect(result).toContain('SUMMARY:Event Name');
    });

    it('should return null and log error if date is invalid', () => {
      const spyLogger = jest.spyOn(Logger.prototype, 'error');
      const result = (mailService as any).generateICalendarData(
        'Event Name',
        'invalid-date',
        'Description',
        'event-123'
      );
      expect(result).toBeNull();
      expect(spyLogger).toHaveBeenCalled();
    });
  });
});
