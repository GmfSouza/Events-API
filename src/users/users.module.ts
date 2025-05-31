import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AwsModule } from 'src/aws/aws.module';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [AwsModule, MailModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService]
})
export class UsersModule {}
