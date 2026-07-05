import 'dotenv/config';
import { z } from 'zod';

/**
 * Central, validated environment configuration.
 * Fails fast at boot if anything required is missing/misshaped.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),

  DATABASE_URL: z.string().url(),
  // Direct (non-pooled) connection for Prisma migrations. Optional at runtime
  // (the client uses DATABASE_URL); Prisma reads it from the environment for
  // `migrate`/`introspect`. Defaults to DATABASE_URL when unset.
  DIRECT_URL: z.string().url().optional(),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  // Per-account brute-force lockout: lock after N failed logins for M minutes.
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().min(1).default(15),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_UPLOAD_FOLDER: z.string().default('rawaqan'),

  SEED_ADMIN_EMAIL: z.string().email().default('admin@rawaqan.local'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('Admin@12345'),
  SEED_ADMIN_NAME: z.string().default('Rawaqan Admin'),

  PUBLIC_SITE_URL: z.string().url().default('http://localhost:5173'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
   
  console.error('❌ Invalid environment configuration:\n', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';

export const cloudinaryEnabled = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
);
