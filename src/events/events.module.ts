import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { AwsModule } from 'src/aws/aws.module';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from 'src/users/users.module';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [AwsModule, ConfigModule, UsersModule, MailModule],
  controllers: [EventsController],
  providers: [EventsService]
})
export class EventsModule {}
