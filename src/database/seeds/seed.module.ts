import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AwsModule } from 'src/aws/aws.module';
import { UsersModule } from 'src/users/users.module';
import { SeedService } from './seed.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    UsersModule,
    AwsModule,
  ],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}
