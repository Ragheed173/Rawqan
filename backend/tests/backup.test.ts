import { describe, expect, it } from "vitest";
import {
  BACKUP_EXCLUDED_DOMAINS,
  BACKUP_KIND,
  BACKUP_SCOPE,
  BACKUP_VERSION,
  parseBackupPayload,
} from "../src/modules/data/backup.service.js";

const data = {
  settings: null,
  openingHours: [],
  categories: [],
  items: [],
    images: [],
    tags: [],
    itemTags: [],
    modifierGroups: [],
    modifierOptions: [],
    menuItemModifierGroups: [],
};

describe("menu/settings backup envelope", () => {
  it("accepts the scoped v2 format and explicitly excludes POS finance", () => {
    const parsed = parseBackupPayload({
      kind: BACKUP_KIND,
      version: BACKUP_VERSION,
      scope: BACKUP_SCOPE,
      excludedDomains: BACKUP_EXCLUDED_DOMAINS,
      createdAt: "2026-08-23T00:00:00.000Z",
      data,
    });
    expect(parsed).toEqual(data);
    expect(BACKUP_EXCLUDED_DOMAINS).toContain("POS_FINANCIAL");
  });

  it("keeps backward-compatible restore parsing for v1 backups", () => {
    expect(parseBackupPayload({ version: 1, data })).toEqual(data);
  });

  it("rejects unknown versions and unscoped future envelopes", () => {
    expect(() => parseBackupPayload({ version: 3, data })).toThrow();
    expect(() =>
      parseBackupPayload({
        kind: BACKUP_KIND,
        version: 2,
        scope: "FULL_DATABASE",
        excludedDomains: [],
        createdAt: "2026-08-23T00:00:00.000Z",
        data,
      }),
    ).toThrow();
  });
});
