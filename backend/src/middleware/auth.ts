// This file checks that a request has a valid login token before
// letting it continue to the actual route.
import { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../utils/token';

// Add an "auth" field to Express's Request type so we can attach
// the logged-in user's info to it.
declare global {
  namespace Express {
    interface Request {
      auth?: {
        uid: string;
        email: string;
        role: string;
      };
    }
  }
}

// Middleware that blocks the request unless it has a valid "Bearer" token.
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  // No token, or wrong format -> reject the request.
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization token is missing.' });
  }

  // Remove the "Bearer " prefix to get the raw token.
  const token = authHeader.slice(7);

  try {
    // Check the token is real and not expired, then read the user info from it.
    const payload = verifyToken(token);
    req.auth = {
      uid: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    // Token is good, let the request continue.
    next();
  } catch {
    // Token is broken or expired.
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}
