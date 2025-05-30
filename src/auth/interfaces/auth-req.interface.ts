import { Request } from 'express';
import { User } from 'src/users/interfaces/user.interface';

export interface AuthRequest extends Request {
	user: Omit<User, 'password'>;
}