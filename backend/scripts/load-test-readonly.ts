import { performance } from "node:perf_hooks";

function integerSetting(name: string, fallback: number, maximum: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${name} must be an integer between 1 and ${maximum}.`);
  }
  return value;
}

function decimalSetting(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be between 0 and 1.`);
  }
  return value;
}

const baseUrl = new URL(
  process.env.LOAD_TEST_BASE_URL ?? "http://localhost:4000",
);
const requestCount = integerSetting("LOAD_TEST_REQUESTS", 120, 5_000);
const concurrency = integerSetting("LOAD_TEST_CONCURRENCY", 4, 50);
const timeoutMs = integerSetting("LOAD_TEST_TIMEOUT_MS", 75_000, 120_000);
const maxP95Ms = integerSetting("LOAD_TEST_MAX_P95_MS", 2_500, 120_000);
const maxErrorRate = decimalSetting("LOAD_TEST_MAX_ERROR_RATE", 0.01);
const paths = (process.env.LOAD_TEST_PATHS ??
  "/ready,/api/categories,/api/items")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

if (!paths.length || paths.some((value) => !value.startsWith("/"))) {
  throw new Error("LOAD_TEST_PATHS must contain relative paths beginning with /.");
}

interface Sample {
  path: string;
  status: number;
  durationMs: number;
  bytes: number;
  error?: string;
}

async function request(pathname: string): Promise<Sample> {
  const url = new URL(pathname, baseUrl);
  const startedAt = performance.now();
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json", "user-agent": "rawaqan-load-check/1" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await response.arrayBuffer();
    return {
      path: pathname,
      status: response.status,
      durationMs: performance.now() - startedAt,
      bytes: body.byteLength,
      ...(!response.ok ? { error: `HTTP ${response.status}` } : {}),
    };
  } catch (error) {
    return {
      path: pathname,
      status: 0,
      durationMs: performance.now() - startedAt,
      bytes: 0,
      error: error instanceof Error ? error.name : "RequestError",
    };
  }
}

function percentile(sorted: number[], percentileValue: number) {
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((percentileValue / 100) * sorted.length) - 1,
  );
  return Math.round(sorted[Math.max(0, index)] ?? 0);
}

console.log(`Warming ${baseUrl.origin} with ${paths.length} read-only routes...`);
for (const pathname of paths) {
  const warmup = await request(pathname);
  if (warmup.error) {
    throw new Error(`Warm-up failed for ${pathname}: ${warmup.error}`);
  }
}

const samples: Sample[] = [];
let nextIndex = 0;
const startedAt = performance.now();
await Promise.all(
  Array.from({ length: Math.min(concurrency, requestCount) }, async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= requestCount) return;
      samples.push(await request(paths[index % paths.length]!));
    }
  }),
);
const elapsedMs = performance.now() - startedAt;
const durations = samples.map(({ durationMs }) => durationMs).sort((a, b) => a - b);
const failures = samples.filter(({ error }) => error);
const errorRate = failures.length / samples.length;
const report = {
  target: baseUrl.origin,
  requests: samples.length,
  concurrency,
  elapsedMs: Math.round(elapsedMs),
  requestsPerSecond: Number((samples.length / (elapsedMs / 1_000)).toFixed(2)),
  latencyMs: {
    p50: percentile(durations, 50),
    p95: percentile(durations, 95),
    p99: percentile(durations, 99),
    max: Math.round(durations.at(-1) ?? 0),
  },
  transferredBytes: samples.reduce((sum, sample) => sum + sample.bytes, 0),
  failures: failures.length,
  errorRate: Number(errorRate.toFixed(4)),
  statusCounts: Object.fromEntries(
    [...new Set(samples.map(({ status }) => status))]
      .sort((a, b) => a - b)
      .map((status) => [status, samples.filter((sample) => sample.status === status).length]),
  ),
};

console.log(JSON.stringify(report, null, 2));
if (errorRate > maxErrorRate || report.latencyMs.p95 > maxP95Ms) {
  console.error(
    `Load gate failed: errorRate <= ${maxErrorRate} and p95 <= ${maxP95Ms}ms required.`,
  );
  process.exitCode = 1;
} else {
  console.log("Read-only load gate passed.");
}
