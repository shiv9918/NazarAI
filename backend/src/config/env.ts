// This file reads settings (like keys and URLs) from the .env file and
// prepares them for the rest of the app to use.
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Figure out where this file lives so we can find the .env file next to it.
const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const backendEnvPath = path.resolve(currentDir, '../../.env');

// Always resolve env from backend/.env, even when command is executed from workspace root.
dotenv.config({ path: backendEnvPath });

// Fallback database name if none is given.
const DEFAULT_DATABASE_NAME = 'nazarai';
// Websites that are allowed to call this backend (CORS).
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

// Checks and cleans up the DATABASE_URL so it is a proper, usable connection string.
function normalizeDatabaseUrl(rawValue: string | undefined) {
  if (!rawValue) {
    throw new Error('DATABASE_URL is required');
  }

  // Some tools give a Python-style driver prefix; swap it for the normal one.
  const withoutPythonDriver = rawValue.replace('postgresql+psycopg2://', 'postgresql://');
  let parsed: URL;

  try {
    parsed = new URL(withoutPythonDriver);
  } catch {
    throw new Error('DATABASE_URL is invalid. Use the full PostgreSQL connection string from Render, for example: postgresql://user:password@host:5432/database');
  }

  // Catch the common mistake of pasting only the host name instead of the full URL.
  if (parsed.hostname && !parsed.hostname.includes('.') && !['localhost', '127.0.0.1'].includes(parsed.hostname)) {
    throw new Error(
      'DATABASE_URL looks incomplete. Use the full Render PostgreSQL connection string, not only the host name. Example: postgresql://user:password@host.render.com:5432/database'
    );
  }

  // If no database name was given in the URL, use the default one.
  if (parsed.pathname === '/' || parsed.pathname === '') {
    parsed.pathname = `/${DEFAULT_DATABASE_NAME}`;
  }

  return parsed.toString();
}

// Turns the comma-separated CORS_ORIGINS env value into a clean list of allowed sites,
// always including the default ones.
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

// All the app settings, collected in one place, with sensible defaults where possible.
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
