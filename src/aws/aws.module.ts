import { Module } from '@nestjs/common';
import { S3Service } from './s3/s3.service';
import { DynamoDbService } from './dynamodb/dynamodb.service';
import { UsersModule } from 'src/users/users.module';

@Module({
  providers: [DynamoDbService, S3Service],
  exports: [DynamoDbService, S3Service], 
})
export class AwsModule {}
