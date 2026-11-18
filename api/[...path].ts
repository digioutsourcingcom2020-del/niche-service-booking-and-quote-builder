import { createApp } from '../server/src/app';
import { initDb } from '../server/src/init';
import type { App } from '../server/src/app';

let appPromise: Promise<App> | undefined;

export default {
  async fetch(request: Request): Promise<Response> {
    appPromise ??= initDb().then(() => createApp());
    const app = await appPromise;
    return app.fetch(request);
  },
};
