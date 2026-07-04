import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { cloudinaryEnabled } from './lib/cloudinary.js';

async function bootstrap() {
  const app = createApp();

  const server = app.listen(env.PORT, () => {
     
    console.log(`🚀 Rawaqan API listening on http://localhost:${env.PORT}`);
     
    console.log(`   env=${env.NODE_ENV} · cloudinary=${cloudinaryEnabled ? 'on' : 'off'}`);
  });

  const shutdown = async (signal: string) => {
     
    console.log(`\n${signal} received — shutting down...`);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
   
  console.error('Fatal boot error:', err);
  process.exit(1);
});
