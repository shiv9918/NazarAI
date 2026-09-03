// This file sets up the connection to the PostgreSQL database.
import { Pool } from 'pg';
import { env } from './env';

// Create a pool of database connections using the database URL from env settings.
export const pool = new Pool({
  connectionString: env.databaseUrl,
});

// Simple check to make sure the database is reachable.
export async function testConnection() {
  // Borrow one connection from the pool.
  const client = await pool.connect();
  try {
    // Run a tiny test query.
    await client.query('SELECT 1');
  } finally {
    // Always give the connection back to the pool.
    client.release();
  }
}
