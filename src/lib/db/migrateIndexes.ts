import { Db, MongoServerError } from "mongodb";
import { recordAgentBreadcrumb } from "@/lib/telemetry/sentryTracer";

export interface IndexDescription {
  name: string;
  key: Record<string, number>;
  unique?: boolean;
}

export interface MigrationPlan {
  existingIndexes: IndexDescription[];
  hasLegacyTraceIdIndex: boolean;
  hasCompoundOwnerTraceIndex: boolean;
  unownedDocumentCount: number;
  actions: string[];
  dryRun: boolean;
  status: "ready" | "needs_owner_backfill" | "applied" | "noop";
}

/**
 * Filter to strictly identify documents lacking a valid string ownerId:
 * - Missing ownerId field ($exists: false)
 * - Explicit null ownerId
 * - Non-string types ($not: { $type: "string" })
 * - Empty string or whitespace-only string (/^\s*$/)
 */
export const UNOWNED_OR_INVALID_OWNER_FILTER = {
  $or: [
    { ownerId: { $exists: false } },
    { ownerId: null },
    { ownerId: { $not: { $type: "string" } } },
    { ownerId: { $regex: /^\s*$/ } },
  ],
};

/**
 * Safe, dry-run-first migration helper for GhostTrace MongoDB Atlas indexes.
 *
 * Defaults to `dryRun: true` to prevent any unintended index changes.
 * Never deletes or alters user investigation data.
 */
export async function migrateTraceIndexes(
  db: Db,
  options: { dryRun?: boolean } = { dryRun: true }
): Promise<MigrationPlan> {
  const isDryRun = options.dryRun ?? true;
  const collection = db.collection("investigations");

  let existingIndexes: IndexDescription[] = [];
  let unownedDocumentCount = 0;

  try {
    const rawIndexes = await collection.indexes();
    existingIndexes = rawIndexes.map((idx) => ({
      name: idx.name ?? "unnamed_index",
      key: (idx.key ?? {}) as Record<string, number>,
      unique: Boolean(idx.unique),
    }));

    unownedDocumentCount = await collection.countDocuments(UNOWNED_OR_INVALID_OWNER_FILTER);
  } catch (err) {
    // If collection does not exist yet (NamespaceNotFound, code 26), start with empty indexes
    if (err instanceof MongoServerError && err.code === 26) {
      existingIndexes = [];
      unownedDocumentCount = 0;
    } else {
      throw err;
    }
  }

  // Detect legacy single-field unique index: { traceId: 1 } (unique: true)
  const legacyTraceIdIndex = existingIndexes.find(
    (idx) => idx.key.traceId === 1 && Object.keys(idx.key).length === 1 && idx.unique === true
  );

  // Detect modern multi-tenant compound index: { ownerId: 1, traceId: 1 } (unique: true)
  const compoundOwnerTraceIndex = existingIndexes.find(
    (idx) => idx.key.ownerId === 1 && idx.key.traceId === 1 && idx.unique === true
  );

  const actions: string[] = [];
  let status: MigrationPlan["status"] = "ready";

  if (!compoundOwnerTraceIndex) {
    actions.push("Create compound unique index { ownerId: 1, traceId: 1 }");
  }

  if (unownedDocumentCount > 0) {
    status = "needs_owner_backfill";
    actions.push(
      `Safety guard: ${unownedDocumentCount} legacy documents lack a valid string ownerId (missing, null, whitespace, or non-string). Legacy unique index will NOT be dropped until documents are safely attributed.`
    );
  } else if (legacyTraceIdIndex) {
    actions.push(`Safely drop legacy single-field unique index '${legacyTraceIdIndex.name}'`);
  } else {
    if (compoundOwnerTraceIndex) {
      status = "noop";
      actions.push("All indexes are modern and partitioned. No migration actions required.");
    }
  }

  // If dry-run, stop here and report plan
  if (isDryRun) {
    recordAgentBreadcrumb("workflow", "MongoDB index migration planned (dry-run)", {
      dryRun: true,
      status,
      actionsCount: actions.length,
    });
    return {
      existingIndexes,
      hasLegacyTraceIdIndex: Boolean(legacyTraceIdIndex),
      hasCompoundOwnerTraceIndex: Boolean(compoundOwnerTraceIndex),
      unownedDocumentCount,
      actions,
      dryRun: true,
      status,
    };
  }

  // Live execution mode (dryRun: false)
  // Step A: Ensure compound unique index is created first
  if (!compoundOwnerTraceIndex) {
    await collection.createIndex({ ownerId: 1, traceId: 1 }, { unique: true });
    actions.push("Executed: created compound index { ownerId: 1, traceId: 1 }");
  }

  // Step B: Only drop legacy index if unowned documents count is 0
  if (legacyTraceIdIndex && unownedDocumentCount === 0) {
    await collection.dropIndex(legacyTraceIdIndex.name);
    actions.push(`Executed: dropped legacy index '${legacyTraceIdIndex.name}'`);
    status = "applied";
  } else if (unownedDocumentCount > 0) {
    status = "needs_owner_backfill";
  } else {
    status = "applied";
  }

  recordAgentBreadcrumb("workflow", "MongoDB index migration executed", {
    dryRun: false,
    status,
    unownedDocumentCount,
  });

  return {
    existingIndexes,
    hasLegacyTraceIdIndex: Boolean(legacyTraceIdIndex && unownedDocumentCount > 0),
    hasCompoundOwnerTraceIndex: true,
    unownedDocumentCount,
    actions,
    dryRun: false,
    status,
  };
}
