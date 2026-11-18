import { createApp } from '../server/src/app.js';
import { initDb } from '../server/src/init.js';
import type { App } from '../server/src/app.js';

let appPromise: Promise<App> | undefined;

export default {
  async fetch(request: Request): Promise<Response> {
    appPromise ??= initDb().then(() => createApp());
    const app = await appPromise;
    return app.fetch(request);
  },
};
