import { readFile } from 'node:fs/promises';
import { exec } from './db.js';
import { seed } from './seed.js';

export async function initDb(): Promise<void> {
  const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  await exec(schema);
  await seed();
}
