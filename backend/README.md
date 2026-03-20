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

## Deploy On Render

This repository includes a root `render.yaml` configured for the backend service.

1. Push code to GitHub.
2. In Render, choose "New" -> "Blueprint" and select your repository.
3. Confirm service settings:
	- Root Directory: `backend`
	- Build Command: `npm install && npm run build`
	- Start Command: `npm run start`
	- Health Check Path: `/api/health`
4. Set environment variables in Render:
	- `DATABASE_URL` (from your Render PostgreSQL instance)
	- `JWT_SECRET` (secure random string)
	- `CORS_ORIGINS` (comma-separated frontend URLs)
5. Deploy.

Example `CORS_ORIGINS` value:

`https://your-frontend.onrender.com,http://localhost:3000`
