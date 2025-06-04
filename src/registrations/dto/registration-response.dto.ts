import { Expose, Type } from "class-transformer";
import { EventResponseDto } from "src/events/dto/event-response.dto";
import { RegistrationStatus } from "../enums/registration-status.enum";
import { ApiProperty } from "@nestjs/swagger";

export class RegistrationResponseDto {
  @ApiProperty({
    description: 'The ID of the registration.',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  @Expose()
  id: string; 

  @ApiProperty({
    description: 'The ID of the user.',
    example: '930d9d9k-1234-5678-90ab-cdef12345678',
    format: 'uuid',
  })
  @Expose()
  userId: string;

  @ApiProperty({
    description: 'The ID of the event.',
    example: 'ods0o02-90d09e2-9393-4d5f-8a9b-1234567890ab',
    format: 'uuid',
  })
  @Expose()
  eventId: string;

  @ApiProperty({
    description: 'The date when the registration was created.',
    example: '2023-10-01T12:00:00Z',
    type: String,
  })
  @Expose()
  registrationDate: string;

  @ApiProperty({
    description: 'The status of the registration.',
    enum: RegistrationStatus,
    example: RegistrationStatus.ACTIVE,
  })
  @Expose()
  status: RegistrationStatus;

  @ApiProperty({
    description: 'The date when the registration was last updated.',
    example: '2023-10-01T12:00:00Z',
    type: String,
  })
  @Expose()
  updatedAt: string;

  @ApiProperty({
    description: 'The event details.',
    type: () => EventResponseDto,
  })
  @Expose()
  @Type(() => EventResponseDto) 
  event?: Partial<EventResponseDto>; 

  constructor(partial: Partial<RegistrationResponseDto>) {
    Object.assign(this, partial);
    if (partial.event) {
        this.event = new EventResponseDto(partial.event as any); 
    }
  }
}