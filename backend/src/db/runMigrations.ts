// This file reads the schema.sql file and runs it against the database
// to create or update the tables.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../config/db';

export async function runMigrations() {
  // Find the schema.sql file that sits next to this file.
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);
  const schemaPath = path.join(dirname, 'schema.sql');
  // Read the SQL text and run it on the database.
  const sql = await fs.readFile(schemaPath, 'utf8');
  await pool.query(sql);
}
