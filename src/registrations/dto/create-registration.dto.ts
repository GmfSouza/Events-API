import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateRegistrationDto {
  @IsNotEmpty()
  @IsUUID('4', { message: 'Event ID must be a valid UUID.' })
  eventId: string;
}