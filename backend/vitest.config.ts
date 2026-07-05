import { defineConfig } from 'vitest/config';

/**
 * Unit + no-DB integration tests. Env is injected here so `src/config/env.ts`
 * validates at import time without a real database — none of these tests issue
 * a query (they cover schema parsing, pure helpers, and pre-DB route behavior).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/rawaqan_test?schema=public',
      DIRECT_URL: 'postgresql://user:pass@localhost:5432/rawaqan_test?schema=public',
      JWT_ACCESS_SECRET: 'test-access-secret-0123456789',
      JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789',
      CORS_ORIGINS: 'http://localhost:5173',
      PUBLIC_SITE_URL: 'http://localhost:5173',
    },
  },
});
