import { IsNotEmpty, IsString, Matches, MinLength } from "class-validator";
import { EventStatus } from "../enums/event-status.enum";

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
    @Matches(/^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/25$/, {
        message: 'Date must be in the correct format DD/MM/25',
    })
    date: string;
}