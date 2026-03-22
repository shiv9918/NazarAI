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

## WhatsApp Reporting (Twilio)

Citizens can submit reports by WhatsApp photo + location text using Twilio webhook integration.

### Required environment variables

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_NUMBER` (example: `whatsapp:+14155238886` for sandbox)
- `GEMINI_API_KEY` (for image issue detection)

### Twilio setup

1. Open Twilio WhatsApp Sandbox or your approved WhatsApp sender.
2. Set inbound webhook URL to:

`POST /api/whatsapp/webhook`

Example local URL via ngrok:

`https://<ngrok-id>.ngrok-free.app/api/whatsapp/webhook`

3. Citizen must have their WhatsApp number saved in profile `phone` field in app settings.

### Incoming message format

- Attach one image.
- Include address and coordinates in text, for example:

`Location: Connaught Place, New Delhi 28.6315,77.2167`

### What backend does

1. Identifies citizen from WhatsApp phone.
2. Downloads media from Twilio.
3. Uses Gemini vision to detect issue type/severity.
4. Assigns department automatically.
5. Creates a new report in `reports` table so dashboards update.
6. Replies with complaint ID and assignment confirmation on WhatsApp.

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
