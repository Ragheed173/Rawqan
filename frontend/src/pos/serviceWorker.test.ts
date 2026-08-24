import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");

describe("POS service-worker safety", () => {
  it("precaches the POS shell and uses it for offline POS navigations", () => {
    expect(source).toContain("['/', '/menu', '/pos']");
    expect(source).toContain("url.pathname.startsWith('/pos') ? '/pos' : '/'");
    expect(source).toContain("PRECACHE_POS");
    expect(source).toContain("shellCache.addAll(OFFLINE_URLS)");
    expect(source).toContain("key.includes('src/pos/')");
    expect(source).toContain("event.waitUntil(precachePosAssets())");
    expect(source).toContain("POS_READY_KEY");
    expect(source).toContain("new Set(['index.html'");
    expect(source).toContain("ignoreVary: true");
  });

  it("never broadly caches authenticated API routes", () => {
    expect(source).toContain("CACHEABLE_PUBLIC_API_PATHS");
    expect(source).not.toContain("url.pathname.startsWith('/api/')");
    expect(source).not.toMatch(/method\s*!==\s*["']GET["'][\s\S]*cache\.put\(request/);
  });
});
