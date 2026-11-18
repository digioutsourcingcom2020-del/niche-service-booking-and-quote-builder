import path from 'node:path';

try {
  process.loadEnvFile(path.resolve(process.cwd(), '.env'));
} catch {
  // .env is optional — environment variables may be supplied by the host.
}

const deploymentUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
const deploymentId = process.env.VERCEL_DEPLOYMENT_ID ?? 'preview';

export const config = {
  sqlitePath:
    process.env.SQLITE_PATH?.trim() ||
    (process.env.VERCEL ? `/tmp/gleamworks-${deploymentId}.db` : '.data/gleamworks.db'),
  port: Number(process.env.PORT ?? 8787),
  appUrl: process.env.APP_URL ?? deploymentUrl ?? 'http://localhost:5173',
  mailFrom: process.env.MAIL_FROM ?? 'Gleamworks Studio <bookings@gleamworks.test>',
  resendApiKey: process.env.RESEND_API_KEY?.trim() ? process.env.RESEND_API_KEY.trim() : null,
};
