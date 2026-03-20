import { pool } from '../config/db';
import { runMigrations } from './runMigrations';

async function main() {
  await runMigrations();
  console.log('Migration completed successfully.');
  await pool.end();
}

main().catch(async (error) => {
  console.error('Migration failed:', error);
  await pool.end();
  process.exit(1);
});
