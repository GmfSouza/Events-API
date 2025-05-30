import { Module } from '@nestjs/common';
import { S3Service } from './s3/s3.service';
import { SesService } from './ses/ses.service';
import { DynamoDbService } from './dynamodb/dynamodb.service';
import { UsersModule } from 'src/users/users.module';

@Module({
  providers: [DynamoDbService, S3Service, SesService],
  exports: [DynamoDbService, S3Service, SesService], 
})
export class AwsModule {}
