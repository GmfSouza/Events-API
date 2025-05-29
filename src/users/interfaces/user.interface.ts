export interface User {
  id: string; 
  name: string;
  email: string;
  password?: string; 
  phone: string;
  role: string; 
  profileImageUrl?: string;
  createdAt: string; 
  updatedAt: string; 
  isActive: boolean;
  isEmailValidated: boolean;
}