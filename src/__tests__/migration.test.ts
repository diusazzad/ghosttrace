import { describe, it, expect, vi, beforeEach } from "vitest";
import { migrateTraceIndexes } from "@/lib/db/migrateIndexes";
import { ensureIndexes, MongoIndexVerificationError } from "@/lib/db/mongodb";
import { Db, Collection } from "mongodb";

describe("Safe MongoDB Index Migration & Verification (TASK 01C.1)", () => {
  let mockIndexes: Array<{ name: string; key: Record<string, number>; unique?: boolean }>;
  let mockCountDocuments: ReturnType<typeof vi.fn>;
  let mockCreateIndex: ReturnType<typeof vi.fn>;
  let mockDropIndex: ReturnType<typeof vi.fn>;
  let mockCollection: Collection;
  let mockDb: Db;

  beforeEach(() => {
    mockIndexes = [
      { name: "_id_", key: { _id: 1 } },
      { name: "traceId_1", key: { traceId: 1 }, unique: true }, // Legacy index
      { name: "createdAt_-1", key: { createdAt: -1 } },
    ];
    mockCountDocuments = vi.fn().mockResolvedValue(0);
    mockCreateIndex = vi.fn().mockResolvedValue("ownerId_1_traceId_1");
    mockDropIndex = vi.fn().mockResolvedValue({ ok: 1 });

    mockCollection = {
      indexes: vi.fn().mockImplementation(async () => mockIndexes),
      countDocuments: mockCountDocuments as unknown as Collection["countDocuments"],
      createIndex: mockCreateIndex as unknown as Collection["createIndex"],
      dropIndex: mockDropIndex as unknown as Collection["dropIndex"],
    } as unknown as Collection;

    mockDb = {
      collection: vi.fn().mockReturnValue(mockCollection),
    } as unknown as Db;
  });

  describe("migrateTraceIndexes - Dry-Run First", () => {
    it("defaults to dryRun: true and plans without modifying any database indexes", async () => {
      const plan = await migrateTraceIndexes(mockDb);

      expect(plan.dryRun).toBe(true);
      expect(plan.hasLegacyTraceIdIndex).toBe(true);
      expect(plan.hasCompoundOwnerTraceIndex).toBe(false);
      expect(plan.actions.length).toBeGreaterThan(0);
      expect(plan.actions).toContain("Create compound unique index { ownerId: 1, traceId: 1 }");
      expect(plan.actions).toContain("Safely drop legacy single-field unique index 'traceId_1'");

      // Verify no mutating operations were called in dry-run
      expect(mockCreateIndex).not.toHaveBeenCalled();
      expect(mockDropIndex).not.toHaveBeenCalled();
    });

    it("halts index drop and requires backfill if unowned documents exist in collection", async () => {
      mockCountDocuments.mockResolvedValue(5); // 5 legacy documents lack ownerId

      const plan = await migrateTraceIndexes(mockDb, { dryRun: false });

      expect(plan.status).toBe("needs_owner_backfill");
      expect(plan.unownedDocumentCount).toBe(5);
      // Legacy index must NOT be dropped to prevent data corruption
      expect(mockDropIndex).not.toHaveBeenCalled();
      // Compound index was created
      expect(mockCreateIndex).toHaveBeenCalledWith({ ownerId: 1, traceId: 1 }, { unique: true });
    });

    it("executes safe migration in live mode (dryRun: false) when all documents are owned", async () => {
      mockCountDocuments.mockResolvedValue(0);

      const plan = await migrateTraceIndexes(mockDb, { dryRun: false });

      expect(plan.dryRun).toBe(false);
      expect(plan.status).toBe("applied");
      expect(mockCreateIndex).toHaveBeenCalledWith({ ownerId: 1, traceId: 1 }, { unique: true });
      expect(mockDropIndex).toHaveBeenCalledWith("traceId_1");
    });
  });

  describe("ensureIndexes - Fail-Closed Verification", () => {
    it("verifies and succeeds when required compound indexes are present", async () => {
      mockIndexes = [
        { name: "_id_", key: { _id: 1 } },
        { name: "ownerId_1_traceId_1", key: { ownerId: 1, traceId: 1 }, unique: true },
        { name: "ownerId_1_createdAt_-1", key: { ownerId: 1, createdAt: -1 } },
        { name: "ownerId_1_primaryFailureCategory_1", key: { ownerId: 1, primaryFailureCategory: 1 } },
      ];

      await expect(ensureIndexes(mockDb)).resolves.not.toThrow();
    });

    it("fails closed throwing MongoIndexVerificationError if compound unique index is missing", async () => {
      mockIndexes = [
        { name: "_id_", key: { _id: 1 } },
        { name: "ownerId_1_createdAt_-1", key: { ownerId: 1, createdAt: -1 } },
      ];

      await expect(ensureIndexes(mockDb)).rejects.toThrow(MongoIndexVerificationError);
      await expect(ensureIndexes(mockDb)).rejects.toThrow(
        "Missing required unique compound index { ownerId: 1, traceId: 1 }"
      );
    });

    it("fails closed if compound chronological index is missing", async () => {
      mockIndexes = [
        { name: "_id_", key: { _id: 1 } },
        { name: "ownerId_1_traceId_1", key: { ownerId: 1, traceId: 1 }, unique: true },
      ];

      await expect(ensureIndexes(mockDb)).rejects.toThrow(MongoIndexVerificationError);
      await expect(ensureIndexes(mockDb)).rejects.toThrow(
        "Missing required chronological compound index { ownerId: 1, createdAt: -1 }"
      );
    });
  });
});
