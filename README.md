
<div align="center">
   <img width="1200" height="475" alt="NazarAI Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

   <h1>NazarAI</h1>
   <p><strong>AI-powered civic issue reporting, tracking, and municipal workflow automation.</strong></p>

   <p>
      Citizens report issues with photo + location, AI classifies and routes complaints,
      and municipal or department teams resolve them with real-time status visibility.
   </p>
</div>

## Why NazarAI

NazarAI helps cities respond faster to real-world civic problems such as potholes, garbage overflow,
water leakage, hanging wires, and more.

The platform combines:

- Citizen web portal for reporting and tracking complaints
- Municipal and department dashboards for operations and oversight
- AI-powered issue classification and severity detection
- WhatsApp-based complaint intake and feedback loop
- Weather alerting for proactive department readiness

## Key Features

- Multi-role authentication: citizen, municipal, department, admin
- Complaint lifecycle: reported -> in_progress -> resolved
- AI image analysis for issue type, urgency, and department routing
- Duplicate report detection based on location and image similarity
- WhatsApp webhook flow: photo + location -> complaint creation
- WhatsApp complaint status lookup using complaint ID
- Resolution feedback and reminder workflow over WhatsApp
- Department alert center driven by rainfall forecasts
- Leaderboard and points for citizen engagement
- Bilingual-ready UX support (English and Hindi)

## Tech Stack

### Frontend

- React 19 + TypeScript
- Vite
- Tailwind CSS
- React Router
- Leaflet + React Leaflet
- Recharts

### Backend

- Node.js + TypeScript
- Express
- PostgreSQL (pg)
- JWT auth
- Zod validation
- Twilio WhatsApp/SMS integration

### AI and Integrations

- Google Gemini (image and text analysis)
- OpenWeather API (48-hour rainfall insights)
- Twilio (WhatsApp webhook messaging)

## Project Structure

```text
NazarAI-main/
|- src/                    # Frontend source code
|- backend/
|  |- src/                 # Backend API, services, routes
|  |- src/db/schema.sql    # PostgreSQL schema and migrations
|- public/
|- server.ts               # Root dev server (frontend + mock routes)
|- render.yaml             # Render blueprint for backend deployment
|- vercel.json             # Vercel config for frontend deployment
```

## Quick Start (Local Development)

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm

### 1. Install Dependencies

From repository root:

```bash
npm install
cd backend
npm install
```

### 2. Configure Environment Variables

Create `backend/.env`:

```env
PORT=5000
DATABASE_URL=postgresql://postgres:password@localhost:5432/nazarai
JWT_SECRET=replace-with-a-strong-secret

# CORS and frontend
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
FRONTEND_BASE_URL=http://localhost:5173

# AI
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash

# Twilio (required for WhatsApp/SMS features)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
TWILIO_SMS_NUMBER=+10000000000
TWILIO_MESSAGING_SERVICE_SID=MGXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Weather (required for weather alert module)
OPENWEATHER_API_KEY=your_openweather_key
OPENWEATHER_LAT=28.6139
OPENWEATHER_LON=77.2090
```

Optional frontend env in root `.env.local`:

```env
VITE_API_BASE_URL=http://localhost:5000
VITE_GEMINI_API_KEY=your_gemini_api_key
```

### 3. Run Database Migration

From repository root:

```bash
npm run migrate:backend
```

### 4. Start Backend API (Port 5000)

```bash
cd backend
npm run dev
```

Health check:

```bash
curl http://localhost:5000/api/health
```

### 5. Start Frontend/Dev Server (Port 3000)

In a separate terminal from repository root:

```bash
npm run dev
```

Open: `http://localhost:3000`

## Available Scripts

### Root

- `npm run dev` - Start root dev server (frontend with Vite middleware)
- `npm run dev:backend` - Start backend dev server from root
- `npm run migrate:backend` - Run backend DB migration
- `npm run build` - Build frontend assets
- `npm run preview` - Preview frontend build
- `npm run lint` - Type-check project

### Backend (`backend/`)

- `npm run dev` - Start backend with watch mode
- `npm run migrate` - Run migrations
- `npm run build` - Compile backend TypeScript
- `npm run start` - Start backend

## Core API Modules

- `GET /api/health` - Service and runtime key checks
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login and receive JWT
- `GET /api/auth/me` - Current user profile
- `PATCH /api/auth/me` - Update user profile
- `GET /api/reports` - List role-scoped complaints
- `POST /api/reports` - Create complaint (citizen)
- `PATCH /api/reports/:id/status` - Update complaint status
- `POST /api/whatsapp/webhook` - Twilio inbound webhook
- `GET /api/weather/summary` - Weather + alert summary
- `POST /api/weather/send-alert` - Push department weather alert

## WhatsApp Flow

For WhatsApp complaint intake:

1. Expose backend to internet (ngrok/cloudflared)
2. Set Twilio incoming webhook to:

```text
https://your-public-url/api/whatsapp/webhook
```

3. Ensure citizen phone number exists in user profile
4. Send image + location from WhatsApp to submit complaint

## Deployment

### Backend (Render)

This repository includes `render.yaml` for Render Blueprint deployment.

Required environment variables on Render:

- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGINS`
- `GEMINI_API_KEY`
- Twilio variables (if WhatsApp/SMS is enabled)
- OpenWeather variables (if weather alerts are enabled)

### Frontend (Vercel)

This repository includes `vercel.json` for frontend deployment.
Set `VITE_API_BASE_URL` to your deployed backend URL.

## Troubleshooting

- Port conflict on 5000 or 3000: free the port and restart
- Database connection error: verify `DATABASE_URL` and Postgres service
- 401 or auth failures: confirm `JWT_SECRET` and token flow
- WhatsApp not responding: confirm webhook URL and Twilio credentials
- CORS blocked: update `CORS_ORIGINS` with exact frontend origin
- Gemini errors: verify API key and model availability

## Security Notes

- Never commit `.env` files or API keys
- Use a strong `JWT_SECRET` in production
- Restrict `CORS_ORIGINS` to trusted domains

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Open a pull request

## License

This project is currently unlicensed. Add a `LICENSE` file before public/commercial use.
