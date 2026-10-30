import { connectToDatabase, isMongoConfigured } from "./mongodb";
import { GemmaHypothesis } from "@/lib/ai/gemmaAdapter";
import { recordAgentBreadcrumb, startAgentStepSpan } from "@/lib/telemetry/sentryTracer";

export const DEFAULT_ANONYMOUS_OWNER = "sandbox_anonymous";

export interface StoredInvestigation {
  _id?: string;
  ownerId: string; // Authenticated subject (session.user.sub) or isolated sandbox ID
  traceId: string;
  agentName: string;
  status: "failed" | "completed" | "degraded";
  primaryFailureCategory: string;
  totalDurationMs: number;
  totalTokens: number;
  estimatedCostUsd: number;
  eventsCount: number;
  anomaliesCount: number;
  hypothesis: GemmaHypothesis;
  generatedTestCode: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface SaveResult {
  id: string;
  persisted: boolean;
  storageEngine: "mongodb_atlas" | "in_memory";
  ownerId: string;
}

/**
 * In-memory fallback repository for offline, testing, or air-gapped environments.
 * Partitions storage by ownerId to guarantee multi-tenant isolation even in memory.
 */
class InMemoryTraceStore {
  private store: Map<string, StoredInvestigation> = new Map();

  private makeKey(ownerId: string, traceId: string): string {
    return `${ownerId}:${traceId}`;
  }

  save(data: StoredInvestigation): StoredInvestigation {
    const ownerId = data.ownerId || DEFAULT_ANONYMOUS_OWNER;
    const record: StoredInvestigation = {
      ...data,
      ownerId,
      _id: data._id || `mem_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    };
    this.store.set(this.makeKey(ownerId, data.traceId), record);
    return record;
  }

  getByTraceId(traceId: string, ownerId?: string): StoredInvestigation | null {
    if (ownerId) {
      return this.store.get(this.makeKey(ownerId, traceId)) || null;
    }
    // Backward-compatible fallback for un-scoped queries in test suites
    for (const item of this.store.values()) {
      if (item.traceId === traceId) {
        return item;
      }
    }
    return null;
  }

  list(options?: {
    ownerId?: string;
    agentName?: string;
    category?: string;
    limit?: number;
  }): StoredInvestigation[] {
    let items = Array.from(this.store.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    if (options?.ownerId) {
      items = items.filter((i) => i.ownerId === options.ownerId);
    }

    if (options?.agentName) {
      items = items.filter((i) => i.agentName.toLowerCase() === options.agentName!.toLowerCase());
    }

    if (options?.category) {
      items = items.filter((i) => i.primaryFailureCategory === options.category);
    }

    if (options?.limit && options.limit > 0) {
      items = items.slice(0, options.limit);
    }

    return items;
  }

  clear(): void {
    this.store.clear();
  }

  count(ownerId?: string): number {
    if (ownerId) {
      return Array.from(this.store.values()).filter((i) => i.ownerId === ownerId).length;
    }
    return this.store.size;
  }
}

export const inMemoryTraceStore = new InMemoryTraceStore();

/**
 * Save an investigated trace, hypothesis, and generated test into MongoDB Atlas (or in-memory fallback).
 * Partitioned strictly by ownerId (session.user.sub) to prevent cross-tenant overwriting.
 */
export async function saveInvestigation(data: StoredInvestigation): Promise<SaveResult> {
  const ownerId = data.ownerId?.trim() || DEFAULT_ANONYMOUS_OWNER;

  return startAgentStepSpan(
    {
      stepName: "save_investigation_record",
      op: "gen_ai.data_processing",
      traceId: data.traceId,
      attributes: {
        "db.system": isMongoConfigured() ? "mongodb" : "in_memory",
        "ghosttrace.trace_id": data.traceId,
        "ghosttrace.owner_id": ownerId,
      },
    },
    async () => {
      const recordToSave: StoredInvestigation = {
        ...data,
        ownerId,
        createdAt: data.createdAt || new Date().toISOString(),
      };

      if (!isMongoConfigured()) {
        const saved = inMemoryTraceStore.save(recordToSave);
        recordAgentBreadcrumb("workflow", `Investigation saved to in-memory store (${data.traceId})`, {
          traceId: data.traceId,
          ownerId,
          engine: "in_memory",
        });
        return {
          id: saved._id!,
          persisted: true,
          storageEngine: "in_memory",
          ownerId,
        };
      }

      const { db } = await connectToDatabase();
      if (!db) {
        const saved = inMemoryTraceStore.save(recordToSave);
        return {
          id: saved._id!,
          persisted: true,
          storageEngine: "in_memory",
          ownerId,
        };
      }

      try {
        const collection = db.collection<StoredInvestigation>("investigations");
        // Update query partitioned by BOTH ownerId and traceId to prevent cross-tenant overwrite
        const updateResult = await collection.updateOne(
          { ownerId, traceId: data.traceId },
          { $set: recordToSave },
          { upsert: true }
        );

        const id = updateResult.upsertedId?.toString() || data.traceId;
        recordAgentBreadcrumb("workflow", `Investigation persisted to MongoDB Atlas (${data.traceId})`, {
          traceId: data.traceId,
          ownerId,
          engine: "mongodb_atlas",
        });

        return {
          id,
          persisted: true,
          storageEngine: "mongodb_atlas",
          ownerId,
        };
      } catch (err) {
        console.warn("Failed to write to MongoDB Atlas, falling back to in-memory store:", err);
        const saved = inMemoryTraceStore.save(recordToSave);
        return {
          id: saved._id!,
          persisted: true,
          storageEngine: "in_memory",
          ownerId,
        };
      }
    }
  );
}

/**
 * Retrieve a specific forensic investigation by traceId, scoped to the caller's ownerId.
 * If ownerId is provided, access is strictly denied (returns null) if the trace belongs to another owner.
 */
export async function getInvestigationByTraceId(
  traceId: string,
  ownerId?: string
): Promise<StoredInvestigation | null> {
  if (!isMongoConfigured()) {
    return inMemoryTraceStore.getByTraceId(traceId, ownerId);
  }

  const { db } = await connectToDatabase();
  if (!db) {
    return inMemoryTraceStore.getByTraceId(traceId, ownerId);
  }

  try {
    const filter: Record<string, unknown> = { traceId };
    if (ownerId) {
      filter.ownerId = ownerId;
    }

    const collection = db.collection<StoredInvestigation>("investigations");
    const result = await collection.findOne(filter);
    return result || inMemoryTraceStore.getByTraceId(traceId, ownerId);
  } catch {
    return inMemoryTraceStore.getByTraceId(traceId, ownerId);
  }
}

/**
 * List recent forensic investigations with optional filtering, scoped by ownerId.
 */
export async function listInvestigations(options?: {
  ownerId?: string;
  agentName?: string;
  category?: string;
  limit?: number;
}): Promise<StoredInvestigation[]> {
  const limit = options?.limit ?? 20;

  if (!isMongoConfigured()) {
    return inMemoryTraceStore.list(options);
  }

  const { db } = await connectToDatabase();
  if (!db) {
    return inMemoryTraceStore.list(options);
  }

  try {
    const filter: Record<string, unknown> = {};
    if (options?.ownerId) {
      filter.ownerId = options.ownerId;
    }
    if (options?.agentName) {
      filter.agentName = { $regex: new RegExp(options.agentName, "i") };
    }
    if (options?.category) {
      filter.primaryFailureCategory = options.category;
    }

    const collection = db.collection<StoredInvestigation>("investigations");
    const docs = await collection.find(filter).sort({ createdAt: -1 }).limit(limit).toArray();

    if (docs.length === 0) {
      return inMemoryTraceStore.list(options);
    }

    return docs.map((d) => ({
      ...d,
      _id: d._id ? d._id.toString() : undefined,
    }));
  } catch {
    return inMemoryTraceStore.list(options);
  }
}

/**
 * Aggregate forensic failure statistics across stored agent traces, optionally scoped to ownerId.
 */
export async function getTraceStatistics(ownerId?: string): Promise<{
  totalTraces: number;
  failureCategoryCounts: Record<string, number>;
  averageTokens: number;
}> {
  const investigations = await listInvestigations({ ownerId, limit: 100 });
  const categoryCounts: Record<string, number> = {};
  let totalTokens = 0;

  for (const inv of investigations) {
    categoryCounts[inv.primaryFailureCategory] = (categoryCounts[inv.primaryFailureCategory] || 0) + 1;
    totalTokens += inv.totalTokens || 0;
  }

  return {
    totalTraces: investigations.length,
    failureCategoryCounts: categoryCounts,
    averageTokens: investigations.length > 0 ? Math.round(totalTokens / investigations.length) : 0,
  };
}
