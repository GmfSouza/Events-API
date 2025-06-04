import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateRegistrationDto {
  @ApiProperty({
    description: 'The ID of the user registering for the event.',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  @IsNotEmpty()
  @IsUUID('4', { message: 'Event ID must be a valid UUID.' })
  eventId: string;
}