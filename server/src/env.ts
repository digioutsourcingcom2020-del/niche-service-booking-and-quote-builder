import path from 'node:path';

try {
  process.loadEnvFile(path.resolve(process.cwd(), '.env'));
} catch {
  // .env is optional — environment variables may be supplied by the host.
}

export const config = {
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://booking:booking@localhost:5433/booking',
  port: Number(process.env.PORT ?? 8787),
  appUrl: process.env.APP_URL ?? 'http://localhost:5173',
  mailFrom: process.env.MAIL_FROM ?? 'Gleamworks Studio <bookings@gleamworks.test>',
  resendApiKey: process.env.RESEND_API_KEY?.trim() ? process.env.RESEND_API_KEY.trim() : null,
};
