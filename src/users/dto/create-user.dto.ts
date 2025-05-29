import { IsEmail, IsEnum, IsNotEmpty, IsString, Matches, Min, MinLength } from "class-validator";
import { UserRole } from "../enums/user-role.enum";

export class CreateUserDto {
    @IsNotEmpty()
    @IsString()
    @MinLength(3)
    name: string;

    @IsNotEmpty()
    @IsString()
    @IsEmail()
    email:string;

    @IsNotEmpty()
    @IsString()
    @Matches( /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, {
        message: 'Password must contain minimum 8 characters, including letters, numbers, and special characters)'
    })    
    password: string;

    @IsNotEmpty()
    @Matches(/^\+?[0-9\s\-()]{10,20}$/, {
        message: 'Phone number format is invalid',
    })
    phone: string;

    @IsEnum(UserRole, {
        message: 'Invalid user role. Valid roles are: ADMIN, ORGANIZER, PARTICIPANT',
    })
    @IsNotEmpty()
    role: string;
}