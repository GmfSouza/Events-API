import * as provisionDbScript from './provision-db';
import { DynamoDBClient, ListTablesCommand, CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { waitUntilTableExists } from '@aws-sdk/client-dynamodb';

jest.mock('@aws-sdk/client-dynamodb', () => {
  const actual = jest.requireActual('@aws-sdk/client-dynamodb');
  return {
    ...actual,
    DynamoDBClient: jest.fn(),
    ListTablesCommand: jest.fn(),
    CreateTableCommand: jest.fn(),
    waitUntilTableExists: jest.fn(),
  };
});

describe('provision-db.ts', () => {
  let mockSend: jest.Mock;
  let mockDbClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_ACCESS_KEY_ID = 'key';
    process.env.AWS_SECRET_ACCESS_KEY = 'secret';
    process.env.AWS_SESSION_TOKEN = 'token';
    process.env.USERS_TABLE_NAME = 'Users';
    process.env.EVENTS_TABLE_NAME = 'Events';
    process.env.REGISTRATIONS_TABLE_NAME = 'Registrations';

    mockSend = jest.fn();
    mockDbClient = { send: mockSend };
    (DynamoDBClient as jest.Mock).mockImplementation(() => mockDbClient);
    (waitUntilTableExists as jest.Mock).mockResolvedValue(undefined);

    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should skip table creation if table already exists', async () => {
    mockSend.mockResolvedValueOnce({ TableNames: ['Users', 'Events', 'Registrations'] });
    await provisionDbScript['createTable']({
      TableName: 'Users',
      AttributeDefinitions: [],
      KeySchema: [],
      BillingMode: 'PAY_PER_REQUEST',
      GlobalSecondaryIndexes: [],
    });
    expect(console.log).toHaveBeenCalledWith('Table Users already exists. Skipping creation.');
  });

  it('should create table if not exists and wait until active', async () => {
    mockSend.mockResolvedValueOnce({ TableNames: [] }); 
    mockSend.mockResolvedValueOnce({}); 
    await provisionDbScript['createTable']({
      TableName: 'Users',
      AttributeDefinitions: [],
      KeySchema: [],
      BillingMode: 'PAY_PER_REQUEST',
      GlobalSecondaryIndexes: [],
    });
    expect(mockSend).toHaveBeenCalledWith(expect.any(ListTablesCommand));
    expect(mockSend).toHaveBeenCalledWith(expect.any(CreateTableCommand));
    expect(waitUntilTableExists).toHaveBeenCalledWith(
      { client: mockDbClient, maxWaitTime: 180 },
      { TableName: 'Users' }
    );
    expect(console.log).toHaveBeenCalledWith('Table Users created successfully.');
  });

  it('should log error and throw if createTable fails', async () => {
    mockSend.mockResolvedValueOnce({ TableNames: [] });
    mockSend.mockRejectedValueOnce(new Error('fail'));
    await expect(
      provisionDbScript['createTable']({
        TableName: 'Users',
        AttributeDefinitions: [],
        KeySchema: [],
        BillingMode: 'PAY_PER_REQUEST',
        GlobalSecondaryIndexes: [],
      })
    ).rejects.toThrow('fail');
    expect(console.error).toHaveBeenCalledWith(
      'Error creating table Users:',
      expect.any(Error)
    );
  });

  it('should log error and return if table name is missing in provisionTables', async () => {
    const badParams = {
      TableName: undefined,
      AttributeDefinitions: [],
      KeySchema: [],
      BillingMode: 'PAY_PER_REQUEST',
      GlobalSecondaryIndexes: [],
    };
    await provisionDbScript['provisionTables']([badParams]);
    expect(console.error).toHaveBeenCalledWith(
      'Table name is missing in the table parameters.'
    );
  });

  it('should provision all tables successfully', async () => {
    mockSend.mockResolvedValue({ TableNames: [] });
    const params = [
      {
        TableName: 'Users',
        AttributeDefinitions: [],
        KeySchema: [],
        BillingMode: 'PAY_PER_REQUEST',
        GlobalSecondaryIndexes: [],
      },
      {
        TableName: 'Events',
        AttributeDefinitions: [],
        KeySchema: [],
        BillingMode: 'PAY_PER_REQUEST',
        GlobalSecondaryIndexes: [],
      },
    ];
    await provisionDbScript['provisionTables'](params);
    expect(console.log).toHaveBeenCalledWith('All tables provisioned successfully.');
  });

  it('should exit process on error in provisionTables', async () => {
    mockSend.mockResolvedValueOnce({ TableNames: [] });
    mockSend.mockRejectedValueOnce(new Error('fail'));
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    await provisionDbScript['provisionTables']([
      {
        TableName: 'Users',
        AttributeDefinitions: [],
        KeySchema: [],
        BillingMode: 'PAY_PER_REQUEST',
        GlobalSecondaryIndexes: [],
      },
    ]).catch(() => {});
    expect(exitSpy).not.toHaveBeenCalled(); 
    exitSpy.mockRestore();
  });
});