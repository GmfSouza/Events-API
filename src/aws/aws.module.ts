import { Module } from '@nestjs/common';
import { S3Service } from './s3/s3.service';
import { SesService } from './ses/ses.service';
import { DynamodbService } from './dynamodb/dynamodb.service';

@Module({
  providers: [DynamodbService, S3Service, SesService],
  exports: [DynamodbService, S3Service, SesService], 
})
export class AwsModule {}
