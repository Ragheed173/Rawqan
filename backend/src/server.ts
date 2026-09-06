import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { cloudinaryEnabled } from './lib/cloudinary.js';
import {
  captureBackendException,
  flushMonitoring,
  initializeMonitoring,
} from './lib/monitoring.js';

async function bootstrap() {
  initializeMonitoring();
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    console.log(`🚀 Rawaqan API listening on http://localhost:${env.PORT}`);
    console.log(`   env=${env.NODE_ENV} · cloudinary=${cloudinaryEnabled ? 'on' : 'off'}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received — shutting down...`);
    server.close();
    await flushMonitoring();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  captureBackendException(err, { area: 'bootstrap' });
  console.error('Fatal boot error:', err);
  void flushMonitoring().finally(() => process.exit(1));
});
