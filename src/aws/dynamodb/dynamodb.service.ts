import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

@Injectable()
export class DynamoDbService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DynamoDbService.name);
  public readonly docClient: DynamoDBDocumentClient;
  public readonly client: DynamoDBClient;

  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
    const token = this.configService.get<string>('AWS_SESSION_TOKEN');

    if (!region) {
      const errorMessage = 'AWS_REGION is not defined in environment variables';
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    const clientOptions: DynamoDBClientConfig = {
      region: region,
    };

    if (accessKeyId && secretAccessKey) {
      this.logger.log('Configuring DynamoDB client with AWS credentials in .env');
      clientOptions.credentials = {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
        sessionToken: token,
      };
    } else {
      this.logger.log('AWS credentials not  defined in .env');
    }

    this.client = new DynamoDBClient(clientOptions);
    this.docClient = DynamoDBDocumentClient.from(this.client)

    this.logger.log(`DynamoDbService configured for region: ${region}.`);
  }

  async onModuleInit() {
    this.logger.log('DynamoDbService initialized.');
  }

  async onModuleDestroy() {
    this.client.destroy();
    this.logger.log('DynamoDbService destroyed and DynamoDB client finalized.');
  }
}