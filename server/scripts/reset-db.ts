import { pool } from '../src/db';

await pool.query('DROP SCHEMA public CASCADE');
await pool.query('CREATE SCHEMA public');
console.log('Database schema dropped. Start the server to re-migrate and seed.');
await pool.end();
