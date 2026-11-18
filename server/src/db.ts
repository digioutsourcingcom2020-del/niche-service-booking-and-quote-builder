import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './env.js';

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

export interface DbClient {
  query<T extends Record<string, any> = Record<string, any>>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
}

const file = path.resolve(process.cwd(), config.sqlitePath);
mkdirSync(path.dirname(file), { recursive: true });

const db = new DatabaseSync(file);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA busy_timeout = 5000');

export function newId(): string {
  return randomUUID();
}

function bind(params: unknown[]): Array<string | number | bigint | null | Uint8Array> {
  return params.map((value) => {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (value === undefined) return null;
    return value as string | number | bigint | null | Uint8Array;
  });
}

function returnsRows(text: string): boolean {
  return /^\s*(select|with|pragma)\b/i.test(text) || /\breturning\b/i.test(text);
}

function run<T extends Record<string, any>>(text: string, params: unknown[] = []): QueryResult<T> {
  const statement = db.prepare(text);
  if (returnsRows(text)) {
    const rows = statement.all(...bind(params)) as T[];
    return { rows, rowCount: rows.length };
  }
  const info = statement.run(...bind(params));
  return { rows: [], rowCount: Number(info.changes) };
}

export function query<T extends Record<string, any> = Record<string, any>>(
  text: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  return Promise.resolve(run<T>(text, params));
}

export async function exec(sql: string): Promise<void> {
  db.exec(sql);
}

export async function withTransaction<T>(fn: (client: DbClient) => Promise<T>): Promise<T> {
  // Statements are synchronous, so the callback must not await external I/O while the
  // transaction is open — otherwise another request could write inside it.
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = await fn({ query: (text, params) => Promise.resolve(run(text, params)) });
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function closeDb(): void {
  db.close();
}

export class AppError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
