import { defineConfig } from "vitest/config";

/** PostgreSQL-backed tests run serially against an explicitly named test DB. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["integration/**/*.integration.test.ts"],
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 20_000,
    hookTimeout: 20_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: process.env.DATABASE_URL ?? "",
      DIRECT_URL: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
      JWT_ACCESS_SECRET: "integration-access-secret-0123456789",
      JWT_REFRESH_SECRET: "integration-refresh-secret-0123456789",
      CORS_ORIGINS: "http://localhost:5173",
      PUBLIC_SITE_URL: "http://localhost:5173",
    },
  },
});
