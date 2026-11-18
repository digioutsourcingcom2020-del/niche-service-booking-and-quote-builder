import { readFile } from 'node:fs/promises';
import { exec } from './db';
import { seed } from './seed';

export async function initDb(): Promise<void> {
  const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  await exec(schema);
  await seed();
}
