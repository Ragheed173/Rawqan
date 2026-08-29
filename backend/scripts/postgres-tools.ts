import { spawnSync } from "node:child_process";
import path from "node:path";
import { databaseIdentity, parsePostgresUrl } from "../src/ops/databaseBackup.js";

const image = process.env.POSTGRES_TOOLS_IMAGE || "postgres:18-alpine";

export function hasLocalPostgresTool(tool: string) {
  return spawnSync(tool, ["--version"], {
    stdio: "ignore",
    shell: false,
  }).status === 0;
}

function connectionEnvironment(databaseUrl: string) {
  const parsed = parsePostgresUrl("database URL", databaseUrl);
  const identity = databaseIdentity(parsed);
  const env: NodeJS.ProcessEnv = {
    PGHOST: parsed.hostname,
    PGPORT: identity.port,
    PGDATABASE: identity.database,
    PGUSER: decodeURIComponent(parsed.username),
    PGPASSWORD: decodeURIComponent(parsed.password),
  };
  const mappings: Record<string, string> = {
    sslmode: "PGSSLMODE",
    channel_binding: "PGCHANNELBINDING",
    application_name: "PGAPPNAME",
    options: "PGOPTIONS",
  };
  for (const [queryKey, envKey] of Object.entries(mappings)) {
    const value = parsed.searchParams.get(queryKey);
    if (value) env[envKey] = value;
  }
  return env;
}

export interface PostgresToolOptions {
  databaseUrl?: string;
  backupDirectory?: string;
  capture?: boolean;
}

export function backupPathForTool(
  hostDirectory: string,
  filename: string,
  localTool: boolean,
) {
  return localTool
    ? path.join(hostDirectory, filename)
    : `/backup/${filename}`;
}

export function runPostgresTool(
  tool: "pg_dump" | "pg_restore" | "psql",
  args: string[],
  options: PostgresToolOptions = {},
) {
  const localTool = hasLocalPostgresTool(tool);
  const connectionEnv = options.databaseUrl
    ? connectionEnvironment(options.databaseUrl)
    : {};
  const env = { ...process.env, ...connectionEnv };
  const encoding = options.capture ? "utf8" : undefined;
  const stdio = options.capture ? "pipe" : "inherit";

  const result = localTool
    ? spawnSync(tool, args, { env, encoding, stdio, shell: false })
    : spawnSync(
        "docker",
        [
          "run",
          "--rm",
          ...Object.keys(connectionEnv).flatMap((key) => ["-e", key]),
          ...(options.backupDirectory
            ? ["-v", `${path.resolve(options.backupDirectory)}:/backup`]
            : []),
          image,
          tool,
          ...args,
        ],
        { env, encoding, stdio, shell: false },
      );

  if (result.error) {
    throw new Error(`Could not start ${tool}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const stderr = typeof result.stderr === "string" ? result.stderr.trim() : "";
    throw new Error(`${tool} failed${stderr ? `: ${stderr}` : "."}`);
  }
  return typeof result.stdout === "string" ? result.stdout : "";
}

export function postgresToolVersion(tool: "pg_dump" | "pg_restore") {
  return runPostgresTool(tool, ["--version"], { capture: true }).trim();
}
