import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";

export class CreateEventDto {
    @ApiProperty({
    description: 'Event name (must be unique)',
    example: 'Technology Conference',
    minLength: 5,
    maxLength: 100,
  })
    @IsNotEmpty()
    @IsString()
    @MinLength(3, {
        message: 'The name of event cannot be shorter than 3 characters',
    })
    @MaxLength(100, {
        message: 'The name of event cannot be longer than 100 characters',
    })
    name: string;

    @ApiProperty({
        description: 'Event description',
        example: 'A conference about technology.',
        minLength: 15,
        maxLength: 500,
    })
    @IsNotEmpty()
    @IsString()
    @MinLength(15, {
        message: 'The description of event cannot be shorter than 15 characters',
    })
    @MaxLength(500, {
        message: 'The description of event cannot be longer than 500 characters',
    })
    description: string;

    @ApiProperty({
        description: 'Date of the event in YYYY-MM-DD format',
        example: '2026-01-15T18:00:00Z',
        type: String,
        format: 'date-time',
    })
    @IsNotEmpty()
    @IsString()
    @IsDateString({}, {
        message: 'Date must be a valid date in the format YYYY-MM-DD',
    })
    date: string;
}