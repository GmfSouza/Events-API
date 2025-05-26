import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { EventsModule } from './events/events.module';
import { RegistrationsModule } from './registrations/registrations.module';
import { AwsModule } from './aws/aws.module';
@Module({
  imports: [AuthModule, UsersModule, EventsModule, RegistrationsModule, AwsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
