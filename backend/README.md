# NazarAI Backend (PostgreSQL Auth)

## Setup

1. Copy `.env.example` to `.env`.
2. Set `DATABASE_URL` and `JWT_SECRET`.
3. Install deps: `npm install`
4. Run migration: `npm run migrate`
5. Start dev server: `npm run dev`

## Auth Endpoints

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me` (Bearer token)
