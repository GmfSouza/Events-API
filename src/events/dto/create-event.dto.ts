import { IsDateString, IsNotEmpty, IsString, MinLength } from "class-validator";

export class CreateEventDto {
    @IsNotEmpty()
    @IsString()
    @MinLength(3, {
        message: 'The name of event cannot be shorter than 3 characters',
    })
    name: string;

    @IsNotEmpty()
    @IsString()
    @MinLength(15, {
        message: 'The description of event cannot be shorter than 15 characters',
    })
    description: string;

    @IsNotEmpty()
    @IsString()
    @IsDateString({}, {
        message: 'Date must be a valid date in the format YYYY-MM-DD',
    })
    date: string;
}