// src/events/dto/event-response.dto.ts
import { Exclude, Expose, Type } from 'class-transformer';
import { EventStatus } from '../enums/event-status.enum';
import { UserResponseDto } from '../../users/dto/user-response.dto'; 

class EventOrganizerDto {
  @Expose()
  id: string;

  @Expose()
  name: string;
}


@Exclude()
export class EventResponseDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  description: string;

  @Expose()
  date: string;

  @Expose()
  @Type(() => EventOrganizerDto)
  organizer?: EventOrganizerDto;

  @Expose()
  imageUrl?: string | null;

  @Expose()
  status: EventStatus;

  @Expose()
  createdAt: string;

  @Expose()
  updatedAt: string;

  constructor(partial: Partial<EventResponseDto>) {
    Object.assign(this, partial);
  }
}