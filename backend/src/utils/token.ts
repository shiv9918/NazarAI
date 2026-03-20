import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UserRole } from '../types/auth';

export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export function signToken(payload: AuthTokenPayload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '7d' });
}

export function verifyToken(token: string) {
  return jwt.verify(token, env.jwtSecret) as AuthTokenPayload;
}
