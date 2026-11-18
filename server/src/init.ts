import { readFile } from 'node:fs/promises';
import { pool } from './db';
import { seed } from './seed';

export async function initDb(): Promise<void> {
  const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  await pool.query(schema);
  await seed();
}
