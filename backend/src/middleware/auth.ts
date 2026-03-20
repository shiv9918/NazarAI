import { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../utils/token';

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

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization token is missing.' });
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyToken(token);
    req.auth = {
      uid: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}
