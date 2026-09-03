// This file creates and checks the login tokens (JWTs) used to keep users signed in.
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UserRole } from '../types/auth';

// What we store inside a login token.
export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
}

// Create a new login token for a user, valid for 7 days.
export function signToken(payload: AuthTokenPayload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '7d' });
}

// Check a token is valid and read the user info out of it.
export function verifyToken(token: string) {
  return jwt.verify(token, env.jwtSecret) as AuthTokenPayload;
}
