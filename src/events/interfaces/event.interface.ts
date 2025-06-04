import { EventStatus } from "../enums/event-status.enum";

export interface Event {
    id: string;
    name: string;
    description: string;
    date: string;
    imageUrl: string;
    organizerId: string;
    status: EventStatus;
    createdAt: string;
    updatedAt: string;
}