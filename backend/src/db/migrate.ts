// Small script you run to set up/update the database tables.
import { pool } from '../config/db';
import { runMigrations } from './runMigrations';

// Run the migrations, then close the database connection.
async function main() {
  await runMigrations();
  console.log('Migration completed successfully.');
  await pool.end();
}

// Start the script. If it fails, show the error and stop with an error code.
main().catch(async (error) => {
  console.error('Migration failed:', error);
  await pool.end();
  process.exit(1);
});
