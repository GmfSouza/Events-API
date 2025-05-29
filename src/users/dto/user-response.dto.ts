import { UserRole } from '../enums/user-role.enum';

export class UserResponseDto {
  id: string;

  name: string;

  email: string;

  phone: string;

  role: UserRole;

  profileImageUrl?: string;

  createdAt: string;

  updatedAt: string;

  isActive: boolean;

  isEmailValidated: boolean;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}