import { Expose, Type } from "class-transformer";
import { EventResponseDto } from "src/events/dto/event-response.dto";
import { RegistrationStatus } from "../enums/registration-status.enum";

export class RegistrationResponseDto {
  @Expose()
  id: string; 

  @Expose()
  userId: string;

  @Expose()
  eventId: string;

  @Expose()
  registrationDate: string;

  @Expose()
  status: RegistrationStatus;

  @Expose()
  updatedAt: string;

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