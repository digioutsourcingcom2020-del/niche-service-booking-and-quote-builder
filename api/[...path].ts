let appPromise: Promise<import('../server/src/app').App> | undefined;

export default {
  async fetch(request: Request): Promise<Response> {
    if (!appPromise) {
      process.env.SQLITE_PATH ??= `/tmp/gleamworks-${process.env.VERCEL_DEPLOYMENT_ID ?? 'preview'}.db`;
      if (!process.env.APP_URL && process.env.VERCEL_URL) {
        process.env.APP_URL = `https://${process.env.VERCEL_URL}`;
      }

      appPromise = (async () => {
        const [{ createApp }, { initDb }] = await Promise.all([
          import('../server/src/app'),
          import('../server/src/init'),
        ]);
        await initDb();
        return createApp();
      })();
    }

    const app = await appPromise;
    return app.fetch(request);
  },
};
