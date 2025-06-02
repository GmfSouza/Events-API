import { PartialType } from "@nestjs/swagger";
import { CreateEventDto } from "./create-event.dto";
import { IsDateString, IsOptional, IsUUID } from "class-validator";

export class UpdateEventDto extends PartialType(CreateEventDto) {
    @IsOptional()
    name?: string;
    
    @IsOptional()
    description?: string;
    
    @IsOptional()
    @IsDateString({}, { message: 'Date must be in the correct format YYYY-MM-DD' })
    date?: string;

    @IsOptional()
    @IsUUID('4', { message: 'Organizer ID must be a valid UUID' })
    organizerId?: string;
}