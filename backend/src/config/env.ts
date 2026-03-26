import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const backendEnvPath = path.resolve(currentDir, '../../.env');

// Always resolve env from backend/.env, even when command is executed from workspace root.
dotenv.config({ path: backendEnvPath });

const DEFAULT_DATABASE_NAME = 'nazarai';
const DEFAULT_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://nazarai.live',
  'https://www.nazarai.live',
  'https://admin.nazarai.live',
  'https://dept.nazarai.live',
  'https://nazarar.live',
  'https://www.nazarar.live',
  'https://admin.nazarar.live',
  'https://dept.nazarar.live',
];

function normalizeDatabaseUrl(rawValue: string | undefined) {
  if (!rawValue) {
    throw new Error('DATABASE_URL is required');
  }

  const withoutPythonDriver = rawValue.replace('postgresql+psycopg2://', 'postgresql://');
  const parsed = new URL(withoutPythonDriver);

  if (parsed.pathname === '/' || parsed.pathname === '') {
    parsed.pathname = `/${DEFAULT_DATABASE_NAME}`;
  }

  return parsed.toString();
}

function normalizeCorsOrigins(rawValue: string | undefined) {
  if (!rawValue) {
    return DEFAULT_CORS_ORIGINS;
  }

  const parsed = rawValue
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (!parsed.length) {
    return DEFAULT_CORS_ORIGINS;
  }

  return Array.from(new Set([...DEFAULT_CORS_ORIGINS, ...parsed]));
}

export const env = {
  port: Number(process.env.PORT || 5000),
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
  databaseUrl: normalizeDatabaseUrl(process.env.DATABASE_URL),
  corsOrigins: normalizeCorsOrigins(process.env.CORS_ORIGINS),
  frontendBaseUrl:
    process.env.FRONTEND_BASE_URL
    || (process.env.NODE_ENV === 'production' ? 'https://www.nazarai.live' : 'http://localhost:5173'),
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  whatsappTrackBaseUrl: process.env.WHATSAPP_TRACK_BASE_URL || 'https://www.nazarai.live',
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
  twilioSmsNumber: process.env.TWILIO_SMS_NUMBER,
  twilioMessagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
  twilioWhatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER,
  openWeatherApiKey: process.env.OPENWEATHER_API_KEY,
  openWeatherLat: Number(process.env.OPENWEATHER_LAT || 28.6139),
  openWeatherLon: Number(process.env.OPENWEATHER_LON || 77.209),
};
