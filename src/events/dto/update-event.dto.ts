import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { CreateEventDto } from "./create-event.dto";
import { IsDateString, IsOptional, IsUUID } from "class-validator";

export class UpdateEventDto extends PartialType(CreateEventDto) {
    @ApiPropertyOptional({
        description: 'New event name (must be unique)',
        example: 'Musical Conference',
        minLength: 3,
        maxLength: 100,
    })
    @IsOptional()
    name?: string;
    
    @ApiPropertyOptional({
        description: 'New event description',
        example: 'A conference about music.',
        minLength: 15,
        maxLength: 500,
    })
    @IsOptional()
    description?: string;
    
    @ApiPropertyOptional({
        description: 'New date of the event in YYYY-MM-DD format',
        example: '2026-01-15T18:00:00Z',
        type: String,
        format: 'date-time',
    })
    @IsOptional()
    @IsDateString({}, { message: 'Date must be in the correct format YYYY-MM-DD' })
    date?: string;

        
    @ApiPropertyOptional({
        description: 'New organizer ID',
        example: '123e4567-e89b-12d3-a456-426614174000',
        format: 'uuid',
    })
    @IsOptional()
    @IsUUID('4', { message: 'Organizer ID must be a valid UUID' })
    organizerId?: string;
}