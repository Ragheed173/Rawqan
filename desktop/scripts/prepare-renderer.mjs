import { copyFileSync, existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(desktopRoot, "..");
const buildRoot = join(desktopRoot, ".renderer-build");
const archivePath = join(buildRoot, "frontend.tar");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: false,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} exited with code ${result.status}`);
  }
}

rmSync(buildRoot, { recursive: true, force: true });
mkdirSync(buildRoot, { recursive: true });

const archive = spawnSync("git", ["archive", "--format=tar", "HEAD", "frontend"], {
  cwd: repoRoot,
  encoding: null,
  maxBuffer: 64 * 1024 * 1024,
});
if (archive.error) throw archive.error;
if (archive.status !== 0 || !archive.stdout) {
  throw new Error(`Unable to create clean frontend archive: ${archive.stderr?.toString() ?? "unknown error"}`);
}
writeFileSync(archivePath, archive.stdout);
run("tar", ["-xf", archivePath, "-C", buildRoot]);

// Overlay only the intentional desktop integration files. This deliberately
// ignores unrelated working-tree edits, so a cashier build always contains the
// committed Rawaqan application rather than another local experiment.
const overlays = [
  "frontend/src/layouts/AdminLayout.tsx",
  "frontend/src/pos/components/PosLayout.tsx",
  "frontend/src/pos/printing/ReceiptPrinter.ts",
  "frontend/src/lib/registerSW.ts",
  "frontend/src/types/desktop.d.ts",
];
for (const relativePath of overlays) {
  const source = join(repoRoot, relativePath);
  if (!existsSync(source)) continue;
  const target = join(buildRoot, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}

const stagedFrontend = join(buildRoot, "frontend");
const moduleCandidates = [
  join(repoRoot, "frontend", "node_modules"),
  join(repoRoot, "node_modules"),
];
const frontendModules = moduleCandidates.find(
  (candidate) =>
    existsSync(join(candidate, "vite", "bin", "vite.js")) &&
    existsSync(join(candidate, "@vitejs", "plugin-react")),
);
if (!frontendModules) {
  throw new Error("Frontend dependencies are missing. Run npm.cmd install in the repository first.");
}
symlinkSync(frontendModules, join(stagedFrontend, "node_modules"), "junction");
const tsc = moduleCandidates
  .map((candidate) => join(candidate, "typescript", "bin", "tsc"))
  .find(existsSync);
const vite = join(frontendModules, "vite", "bin", "vite.js");
if (!tsc || !existsSync(vite)) {
  throw new Error("Build dependencies are missing. Run npm.cmd install in the repository first.");
}

run(process.execPath, [tsc, "-b"], { cwd: stagedFrontend });
run(process.execPath, [vite, "build"], { cwd: stagedFrontend });

console.log(`Desktop renderer prepared at ${join(stagedFrontend, "dist")}`);
