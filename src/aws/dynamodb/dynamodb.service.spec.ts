import { DynamoDbService } from './dynamodb.service';
import { Logger } from '@nestjs/common';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');

describe('DynamoDbService', () => {
  let configService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    (DynamoDBClient as jest.Mock).mockClear();
    (DynamoDBDocumentClient.from as jest.Mock).mockClear();
    configService = {
      get: jest.fn((key: string) => {
        const env = {
          AWS_REGION: 'us-east-1',
          AWS_ACCESS_KEY_ID: 'key',
          AWS_SECRET_ACCESS_KEY: 'secret',
          AWS_SESSION_TOKEN: 'token',
        };
        return env[key];
      }),
    };
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  it('should be defined and configure DynamoDB client with credentials', () => {
    const service = new DynamoDbService(configService);
    expect(service).toBeDefined();
    expect(DynamoDBClient).toHaveBeenCalledWith(
      expect.objectContaining({
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'key',
          secretAccessKey: 'secret',
          sessionToken: 'token',
        },
      }),
    );
    expect(DynamoDBDocumentClient.from).toHaveBeenCalledWith(
      expect.any(DynamoDBClient),
    );
    expect(Logger.prototype.log).toHaveBeenCalledWith(
      'Configuring DynamoDB client with AWS credentials in .env',
    );
    expect(Logger.prototype.log).toHaveBeenCalledWith(
      'DynamoDbService configured for region: us-east-1.',
    );
  });

  it('should configure DynamoDB client without credentials', () => {
    configService.get = jest.fn((key: string) =>
      key === 'AWS_REGION' ? 'us-east-1' : undefined,
    );
    const service = new DynamoDbService(configService);
    expect(DynamoDBClient).toHaveBeenCalledWith(
      expect.objectContaining({ region: 'us-east-1' }),
    );
    expect(Logger.prototype.log).toHaveBeenCalledWith(
      'AWS credentials not  defined in .env',
    );
  });

  it('should throw error if region is not defined', () => {
    configService.get = jest.fn(() => undefined);
    expect(() => new DynamoDbService(configService)).toThrow(
      'AWS_REGION is not defined in environment variables',
    );
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      'AWS_REGION is not defined in environment variables',
    );
  });

  it('should log onModuleInit', async () => {
    const service = new DynamoDbService(configService);
    await service.onModuleInit();
    expect(Logger.prototype.log).toHaveBeenCalledWith(
      'DynamoDbService initialized.',
    );
  });

  it('should destroy client and log onModuleDestroy', async () => {
    const destroyMock = jest.fn();
    (DynamoDBClient as any).mockImplementation(() => ({
      destroy: destroyMock,
    }));
    const service = new DynamoDbService(configService);
    (service as any).client = { destroy: destroyMock };
    await service.onModuleDestroy();
    expect(destroyMock).toHaveBeenCalled();
    expect(Logger.prototype.log).toHaveBeenCalledWith(
      'DynamoDbService destroyed and DynamoDB client finalized.',
    );
  });
});
