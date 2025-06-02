import { PartialType } from "@nestjs/swagger";
import { CreateEventDto } from "./create-event.dto";
import { IsOptional, IsUUID } from "class-validator";

export class UpdateEventDto extends PartialType(CreateEventDto) {
    name?: string;
    
    description?: string;
    
    date?: string;

    @IsUUID('4', { message: 'Organizer ID must be a valid UUID' })
    organizerId?: string;
}