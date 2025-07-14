import {
  CreateTableCommand,
  CreateTableCommandInput,
  DynamoDBClient,
  ListTablesCommand,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../../.env') });

console.log('Starting database provisioning...');

const region = process.env.AWS_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const sessionToken = process.env.AWS_SESSION_TOKEN;

if (!region || !accessKeyId || !secretAccessKey) {
  console.error(
    'AWS credentials or region are not set in the environment variables.',
  );
  process.exit(1);
}

const clientConfig = {
  region: region,
  credentials: {
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
    sessionToken: sessionToken,
  },
};

const usersTableName = process.env.USERS_TABLE_NAME || 'Users';
const eventsTableName = process.env.EVENTS_TABLE_NAME || 'Events';
const registrationsTableName =
  process.env.REGISTRATIONS_TABLE_NAME || 'Registrations';

const dbClient = new DynamoDBClient(clientConfig);

const userTableParams: CreateTableCommandInput = {
  TableName: usersTableName,
  AttributeDefinitions: [
    { AttributeName: 'id', AttributeType: 'S' },
    { AttributeName: 'email', AttributeType: 'S' },
    { AttributeName: 'role', AttributeType: 'S' },
    { AttributeName: 'emailValidationToken', AttributeType: 'S' },
  ],
  KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
  BillingMode: 'PAY_PER_REQUEST',
  GlobalSecondaryIndexes: [
    {
      IndexName: 'email-index',
      KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
      Projection: {
        ProjectionType: 'ALL',
      },
    },
    {
      IndexName: 'role-id-index',
      KeySchema: [
        { AttributeName: 'role', KeyType: 'HASH' },
        { AttributeName: 'id', KeyType: 'RANGE' },
      ],
      Projection: {
        ProjectionType: 'ALL',
      },
    },
    {
      IndexName: 'emailValidationToken-index',
      KeySchema: [
        { AttributeName: 'emailValidationToken', KeyType: 'HASH' },
      ],
      Projection: {
        ProjectionType: 'ALL',
      },
    }
  ],
};

const eventTableParams: CreateTableCommandInput = {
  TableName: eventsTableName,
  AttributeDefinitions: [
    { AttributeName: 'id', AttributeType: 'S' },
    { AttributeName: 'name', AttributeType: 'S' },
    { AttributeName: 'status', AttributeType: 'S' },
    { AttributeName: 'date', AttributeType: 'S' },
    { AttributeName: 'organizerId', AttributeType: 'S' },
  ],
  KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
  BillingMode: 'PAY_PER_REQUEST',
  GlobalSecondaryIndexes: [
    {
      IndexName: 'name-index',
      KeySchema: [{ AttributeName: 'name', KeyType: 'HASH' }],
      Projection: { ProjectionType: 'KEYS_ONLY' },
    },
    {
      IndexName: 'organizerId-index',
      KeySchema: [{ AttributeName: 'organizerId', KeyType: 'HASH' }],
      Projection: { ProjectionType: 'ALL' },
    },
    {
      IndexName: 'statusAndDate-index',
      KeySchema: [
        { AttributeName: 'status', KeyType: 'HASH' },
        { AttributeName: 'date', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    },
  ],
};

const registrationsTableParams: CreateTableCommandInput = {
  TableName: registrationsTableName,
  AttributeDefinitions: [
    { AttributeName: 'eventId', AttributeType: 'S' },
    { AttributeName: 'userId', AttributeType: 'S' },
  ],
  KeySchema: [
    { AttributeName: 'eventId', KeyType: 'HASH' },
    { AttributeName: 'userId', KeyType: 'RANGE' },
  ],
  BillingMode: 'PAY_PER_REQUEST',
  GlobalSecondaryIndexes: [
    {
      IndexName: 'eventId-userId-index',
      KeySchema: [
        { AttributeName: 'eventId', KeyType: 'HASH' },
        { AttributeName: 'userId', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    },
  ],
};

const tablesToCreate = [
  userTableParams,
  eventTableParams,
  registrationsTableParams,
];

const createTable = async (tableParams: CreateTableCommandInput) => {
  console.log(`Checking if table ${tableParams.TableName} exists...`);
  const existingTables = await dbClient.send(new ListTablesCommand({}));

  if (existingTables.TableNames?.includes(tableParams.TableName!)) {
    console.log(
      `Table ${tableParams.TableName} already exists. Skipping creation.`,
    );
    return;
  }

  try {
    console.log(`Creating table ${tableParams.TableName}...`);
    await dbClient.send(new CreateTableCommand(tableParams));
    console.log(
      `Awaiting for table ${tableParams.TableName} to become active...`,
    );
    await waitUntilTableExists(
      { client: dbClient, maxWaitTime: 180 },
      { TableName: tableParams.TableName },
    );
    console.log(`Table ${tableParams.TableName} created successfully.`);
  } catch (error) {
    console.error(`Error creating table ${tableParams.TableName}:`, error);
    throw error;
  }
};

const provisionTables = async () => {
  for (const tableParams of tablesToCreate) {
    if (!tableParams.TableName) {
      console.error('Table name is missing in the table parameters.');
      return;
    }
    await createTable(tableParams);
  }
  console.log('All tables provisioned successfully.');
};

provisionTables().catch((error) => {
  console.error('Error provisioning tables:', error);
  process.exit(1);
});
