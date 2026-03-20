import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../config/db';

export async function runMigrations() {
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);
  const schemaPath = path.join(dirname, 'schema.sql');
  const sql = await fs.readFile(schemaPath, 'utf8');
  await pool.query(sql);
}
