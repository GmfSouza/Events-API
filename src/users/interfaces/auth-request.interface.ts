import { Request } from "express";
import { UserRole } from "../enums/user-role.enum";

export interface AuthUserPayload extends Request {
  userId: string; 
  email: string;
  role: UserRole; 
}

export interface AuthenticatedRequest extends Request {
  user: AuthUserPayload;
}