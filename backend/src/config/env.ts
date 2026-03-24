import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_DATABASE_NAME = 'nazarai';
const DEFAULT_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
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
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
  twilioWhatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER,
  openWeatherApiKey: process.env.OPENWEATHER_API_KEY,
  openWeatherLat: Number(process.env.OPENWEATHER_LAT || 28.6139),
  openWeatherLon: Number(process.env.OPENWEATHER_LON || 77.209),
};
