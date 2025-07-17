import { Exclude, Expose, Type } from 'class-transformer';
import { EventStatus } from '../enums/event-status.enum';
import { ApiProperty } from '@nestjs/swagger';

export class EventOrganizerDto {
  @ApiProperty({
    description: 'Unique identifier of the event organizer',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: 'Name of the event organizer',
    example: 'Gabryel',
    minLength: 3,
    maxLength: 100,
  })
  @Expose()
  name: string;
}


@Exclude()
export class EventResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the event',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: 'Name of the event',
    example: 'Technology Conference',
    minLength: 3,
    maxLength: 100,
  })
  @Expose()
  name: string;

  @ApiProperty({
    description: 'Description of the event',
    example: 'A conference about technology.',
    minLength: 10,
    maxLength: 500,
  })
  @Expose()
  description: string;

  @ApiProperty({
    description: 'Date of the event',
    example: '2026-01-15T18:00:00Z',
    type: String,
    format: 'date-time',
  })
  @Expose()
  date: string;

  @ApiProperty({
    description: 'Organizer of the event',
    type: () => EventOrganizerDto,
  })
  @Expose()
  @Type(() => EventOrganizerDto)
  organizer?: EventOrganizerDto;

  @ApiProperty({
    description: 'URL of the event image',
    example: 'https://example.com/event-image.jpg',
    required: false,
  })
  @Expose()
  imageUrl: string | null;

  @ApiProperty({
    description: 'Status of the event',
    enum: EventStatus,
    example: EventStatus.ACTIVE,
  })
  @Expose()
  status: EventStatus;

  @ApiProperty({
    description: 'Date when the event was created',
    example: '2024-01-15T18:00:00Z',
    type: String,
    format: 'date-time',
  })
  @Expose()
  createdAt: string;

  @ApiProperty({
    description: 'Date when the event was last updated',
    example: '2024-01-20T18:00:00Z',
    type: String,
    format: 'date-time',
  })
  @Expose()
  updatedAt: string;

  constructor(partial: Partial<EventResponseDto>) {
    Object.assign(this, partial);
  }
}