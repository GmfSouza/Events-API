import { PartialType } from "@nestjs/swagger";
import { CreateEventDto } from "./create-event.dto";
import { IsDateString, IsOptional, IsUUID } from "class-validator";

export class UpdateEventDto extends PartialType(CreateEventDto) {
    name?: string;
    
    description?: string;
    
    @IsDateString({}, { message: 'Date must be in the correct format YYYY-MM-DD' })
    date?: string;

    @IsUUID('4', { message: 'Organizer ID must be a valid UUID' })
    organizerId?: string;
}