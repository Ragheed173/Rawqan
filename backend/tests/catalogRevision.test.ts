import { describe, expect, it, vi } from "vitest";
import {
  getCurrentCatalogRevision,
  recordCatalogChange,
  type CatalogChangeClient,
} from "../src/modules/menu/catalogRevision.js";

describe("catalog revision foundation", () => {
  it("writes an append-only catalog event through an injected transaction client", async () => {
    const create = vi.fn().mockResolvedValue({ revision: 7n });
    const client = {
      catalogChange: { create },
    } as unknown as CatalogChangeClient;
    await recordCatalogChange(client, {
      entityType: "MenuItem",
      entityId: "item-1",
      action: "DELETED",
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        entityType: "MenuItem",
        entityId: "item-1",
        action: "DELETED",
        payload: undefined,
      },
    });
  });

  it("uses revision zero for an empty feed", async () => {
    const client = {
      catalogChange: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as CatalogChangeClient;
    await expect(getCurrentCatalogRevision(client)).resolves.toBe(0n);
  });
});
