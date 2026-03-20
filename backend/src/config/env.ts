import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_DATABASE_NAME = 'nazarai';

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

export const env = {
  port: Number(process.env.PORT || 5000),
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
  databaseUrl: normalizeDatabaseUrl(process.env.DATABASE_URL),
};
