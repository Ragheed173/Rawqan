import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { posDb } from "../db/schema";
import { recoverInterruptedOperations } from "./engine";

beforeEach(async () => { posDb.close(); await posDb.delete(); await posDb.open(); });

describe("POS sync recovery", () => {
  it("requeues an operation left SYNCING by a browser restart", async () => {
    await posDb.syncOperations.put({ operationId: "op", deviceId: "device", localSequence: "1", requestHash: "hash", operationType: "OPEN_ORDER", payload: {}, dependencies: [], status: "SYNCING", attempts: 1, createdAt: new Date().toISOString() });
    await recoverInterruptedOperations();
    expect(await posDb.syncOperations.get("op")).toMatchObject({ status: "FAILED", errorCode: "SYNC_INTERRUPTED", nextAttemptAt: expect.any(String) });
  });
});
