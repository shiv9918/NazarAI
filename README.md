<p align="center">

<!-- NazerAI Title Banner with Gradient -->
<h1 align="center" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 3em; font-weight: bold; margin: 0;">✨ NazarAI ✨</h1>

<h3 align="center" style="color: #888; font-size: 1.2em; margin-top: 10px;">AI-Powered Civic Issue Reporting & Municipal Workflow Automation</h3>

<!-- Badges -->
<p align="center">
  <img src="https://img.shields.io/badge/React-19-black?style=flat&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-black?style=flat&logo=typescript&logoColor=3178C6" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-Express-black?style=flat&logo=node.js&logoColor=339933" alt="Node.js" />
  <img src="https://img.shields.io/badge/PostgreSQL-14-black?style=flat&logo=postgresql&logoColor=4169E1" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Gemini_AI-Latest-black?style=flat&logo=google&logoColor=4285F4" alt="Gemini" />
  <img src="https://img.shields.io/badge/WhatsApp-Twilio-black?style=flat&logo=whatsapp&logoColor=25D366" alt="WhatsApp" />
  <img src="https://img.shields.io/badge/OpenWeather-API-black?style=flat&logo=openweathermap&logoColor=FF8C00" alt="OpenWeather" />
</p>

<!-- Live Demo Badge -->
<p align="center">
  <a href="https://www.nazarai.live/"><img src="https://img.shields.io/badge/🚀_Live_Demo-Visit-2563eb?style=for-the-badge" alt="Live Demo" /></a>
  <a href="https://github.com/shiv9918/NazarAI/blob/main/LICENSE"><img src="https://img.shields.io/github/license/shiv9918/NazarAI?style=for-the-badge&color=orange" alt="License" /></a>
  <a href="https://github.com/shiv9918/NazarAI/stargazers"><img src="https://img.shields.io/github/stars/shiv9918/NazarAI?style=for-the-badge&color=gold" alt="Stars" /></a>
</p>

</p>

---

## 🚀 About NazarAI

NazarAI empowers citizens and municipal authorities to create cleaner, safer cities. Report civic issues with a photo and location — NazarAI's AI engine automatically classifies the issue, determines urgency, routes it to the right department, and tracks resolution in real-time.

---

## 🎯 Why NazarAI?

Modern cities face countless civic challenges every day — potholes, garbage overflow, water leakage, broken streetlights, hanging wires, and more. NazarAI transforms how these issues are handled:

- 🧑 **Citizen Web Portal** — Easy reporting with photo + GPS location
- 🏛️ **Municipal Dashboard** — Real-time complaint tracking & operations oversight
- 🤖 **AI Classification** — Automatic issue type, severity & department routing
- 💬 **WhatsApp Integration** — Report & get status updates via WhatsApp
- 🌧️ **Weather Alerts** — Proactive alerts for departments based on rainfall forecasts
- 🏆 **Gamification** — Leaderboards & points to boost citizen engagement
- 🇮🇳 **Bilingual** — Supports both English and Hindi

---

## 🏗️ System Architecture

```mermaid
flowchart TB
    subgraph Citizen_Layer["👥 Citizen Layer"]
        Web["🌐 Web Portal\nReact + Tailwind"]
        WA["💬 WhatsApp\nTwilio Webhook"]
    end

    subgraph AI_Layer["🤖 AI Engine"]
        Gemini["🧠 Google Gemini\nImage & Text Analysis"]
        OpenCV["📷 OpenCV Model\nImage Detection"]
        Router["🔄 Smart Router\nDept + Urgency Detection"]
    end

    subgraph Backend["⚙️ Backend Services"]
        API["🛠️ Express.js API"]
        DB["📦 PostgreSQL\nComplaints + Users"]
        Weather["🌦️ Weather Service\nRainfall Forecasts"]
    end

    subgraph Admin_Layer["🏛️ Admin Layer"]
        Municipal["📊 Municipal Dashboard"]
        Dept["🏢 Department Panel"]
        Alerts["🚨 Alert Center"]
    end

    Web --> API
    WA --> API
    API --> DB
    API --> OpenCV
    OpenCV --> Gemini
        Gemini --> Router
    Router --> API
    API --> Weather
    API --> Municipal
    API --> Dept
    Weather --> Alerts
    Municipal --> Dept
    Dept --> Web

    style Citizen_Layer fill:#1e3a8a,stroke:#3b82f6,stroke-width:2px
    style AI_Layer fill:#4c1d95,stroke:#8b5cf6,stroke-width:2px
    style Backend fill:#065f46,stroke:#10b981,stroke-width:2px
    style Admin_Layer fill:#7c2d12,stroke:#f97316,stroke-width:2px
```

---

## ⚡ Key Features

| Feature | Description |
|:---|:---|
| 🔐 **Multi-Role Auth** | Citizen, Municipal, Department & Admin roles |
| 📝 **Complaint Lifecycle** | `reported` → `in_progress` → `resolved` with status tracking |
| 🖼️ **AI Image Analysis** | Classifies issue type, urgency level & routes to correct department |
| 🔄 **Duplicate Detection** | Identifies duplicate reports using location & image similarity |
| 📱 **WhatsApp Flow** | Send photo + location via WhatsApp to create complaints instantly |
| 🔍 **Status Lookup** | Check complaint status on WhatsApp using complaint ID |
| 📊 **Resolution Feedback** | Rate & provide feedback after resolution |
| 🌧️ **Weather Alerts** | Proactive department alerts based on rainfall forecasts |
| 🏆 **Leaderboard** | Gamified citizen engagement with points & rankings |
| 🗣️ **Bilingual UX** | Full English + Hindi support |

---

## 🛠️ Tech Stack

### Frontend
<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Leaflet-199900?style=for-the-badge&logo=leaflet&logoColor=white" alt="Leaflet" />
  <img src="https://img.shields.io/badge/Recharts-F56D00?style=for-the-badge&logo=react&logoColor=white" alt="Recharts" />
</p>

### Backend
<p align="center">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=json-web-tokens&logoColor=white" alt="JWT" />
  <img src="https://img.shields.io/badge/Zod-black?style=for-the-badge&logo=zod&logoColor=white" alt="Zod" />
</p>

### AI & Integrations
<p align="center">
  <img src="https://img.shields.io/badge/Google_Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Gemini" />
  <img src="https://img.shields.io/badge/Twilio-F22F46?style=for-the-badge&logo=twilio&logoColor=white" alt="Twilio" />
  <img src="https://img.shields.io/badge/OpenWeather-FF8C00?style=for-the-badge&logo=openweathermap&logoColor=white" alt="OpenWeather" />
</p>

---

## 📁 Project Structure

```
NazarAI/
├── src/                    # Frontend source code (React + Vite)
│   ├── components/
│   ├── pages/
│   └── services/
├── backend/
│   └── src/
│       ├── routes/         # API endpoints
│       ├── services/       # Business logic
│       ├── middleware/     # Auth & validation
│       └── db/
│           └── schema.sql  # PostgreSQL migrations
├── public/                 # Static assets
├── server.ts               # Root dev server
├── render.yaml             # Render deployment config
├── vercel.json             # Vercel frontend config
└── vite.config.ts          # Vite configuration
```

---

## 🏃 Quick Start

### Prerequisites
- **Node.js** 18+
- **PostgreSQL** 14+
- **npm**

### 1️⃣ Install Dependencies
```bash
npm install
cd backend && npm install
```

### 2️⃣ Configure Environment Variables

Create `backend/.env`:
```env
# Server
PORT=5000
DATABASE_URL=postgresql://postgres:password@localhost:5432/nazarai
JWT_SECRET=replace-with-a-strong-secret

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
FRONTEND_BASE_URL=http://localhost:5173

# AI
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash

# Twilio
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# OpenWeather
OPENWEATHER_API_KEY=your_openweather_key
```

### 3️⃣ Run Database Migration
```bash
npm run migrate:backend
```

### 4️⃣ Start Backend (Port 5000)
```bash
cd backend && npm run dev
```

### 5️⃣ Start Frontend (Port 3000)
```bash
npm run dev
```

Visit **`http://localhost:3000`** in your browser! 🎉

---

## 📡 Core API Endpoints

| Method | Endpoint | Description |
|:---|:---|:---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/auth/signup` | Register new user |
| `POST` | `/api/auth/login` | Login & get JWT |
| `GET` | `/api/auth/me` | Current user profile |
| `PATCH` | `/api/auth/me` | Update profile |
| `GET` | `/api/reports` | List complaints |
| `POST` | `/api/reports` | Create complaint |
| `PATCH` | `/api/reports/:id/status` | Update status |
| `POST` | `/api/whatsapp/webhook` | Twilio webhook |
| `GET` | `/api/weather/summary` | Weather summary |
| `POST` | `/api/weather/send-alert` | Send weather alert |

---

## 🌐 WhatsApp Flow

1. Expose backend via **ngrok** or **Cloudflare Tunnel**
2. Set Twilio webhook: `https://your-url/api/whatsapp/webhook`
3. Ensure citizen phone is linked to user profile
4. Send **photo + location** via WhatsApp to submit complaint
5. Receive **status updates** & **resolution feedback** requests

---

## ☁️ Deployment

### Backend — Render
Uses `render.yaml` Blueprint. Set env vars:
- `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`
- `GEMINI_API_KEY`, Twilio & OpenWeather keys

### Frontend — Vercel
Uses `vercel.json`. Set `VITE_API_BASE_URL` to deployed backend URL.

---

## 🤝 Contributing

1. 🍴 **Fork** the repository
2. 🌿 **Create** a feature branch
3. 💾 **Commit** your changes
4. 📤 **Push** to the branch
5. 🔃 **Open** a Pull Request

---

## 📄 License

This project is currently **unlicensed**. Add a `LICENSE` file before public/commercial use.

---

<div align="center">

### ⭐ Made with ❤️ by the Team - Techies

[Report Bug](https://github.com/shiv9918/NazarAI/issues) · [Request Feature](https://github.com/shiv9918/NazarAI/issues) · [Live Demo](https://www.nazarai.live/)

</div>
