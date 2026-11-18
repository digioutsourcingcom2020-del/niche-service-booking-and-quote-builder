import { closeDb, exec } from '../src/db';

for (const table of ['emails', 'bookings', 'working_hours', 'services', 'addons', 'sessions', 'users', 'settings']) {
  await exec(`DROP TABLE IF EXISTS ${table}`);
}

closeDb();
console.log('Database tables dropped. Start the server to re-create the schema and seed the demo data.');
