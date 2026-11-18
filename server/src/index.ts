import { existsSync } from 'node:fs';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { config } from './env';
import { initDb } from './init';
import { createApp } from './app';

await initDb();

const app = createApp();

const distPath = './dist/web';
if (existsSync(`${distPath}/index.html`)) {
  app.use('*', serveStatic({ root: distPath }));
  app.get('*', serveStatic({ path: `${distPath}/index.html` }));
} else {
  app.get('/', (c) =>
    c.text('Gleamworks API is running. Start the frontend with "npm run dev:web" or build with "npm run build".'),
  );
}


serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`Gleamworks API listening on http://localhost:${info.port}`);
});

