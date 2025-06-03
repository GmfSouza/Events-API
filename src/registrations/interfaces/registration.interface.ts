import { RegistrationStatus } from "../enums/registration-status.enum";

export interface Registration {
  id: string; 
  userId: string; 
  eventId: string;
  registrationDate: string; 
  status: RegistrationStatus; 
  updatedAt: string; 
}