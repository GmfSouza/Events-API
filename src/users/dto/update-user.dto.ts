import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { IsOptional } from 'class-validator';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({
    description: 'the new name of the user',
    example: 'New Name',
  })
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'the new email of the user. Must be a valid email format',
    example: 'new.email@example.com',
  })
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description:
      'the new password of the user. Must contain at least 8 characters, including letters, numbers, and special characters',
    example: 'newpassword123!',
  })
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({
    description:
      'the new phone number of the user. Must be a valid phone number format',
    example: '+55511912345678',
  })
  @IsOptional()
  phone?: string;
}
