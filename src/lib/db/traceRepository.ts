import { connectToDatabase, isMongoConfigured } from "./mongodb";
import { GemmaHypothesis } from "@/lib/ai/gemmaAdapter";
import { recordAgentBreadcrumb, startAgentStepSpan } from "@/lib/telemetry/sentryTracer";

export interface StoredInvestigation {
  _id?: string;
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
}

/**
 * In-memory fallback repository for offline, testing, or air-gapped environments.
 */
class InMemoryTraceStore {
  private store: Map<string, StoredInvestigation> = new Map();

  save(data: StoredInvestigation): StoredInvestigation {
    const record = { ...data, _id: data._id || `mem_${Date.now()}_${Math.random().toString(36).substring(7)}` };
    this.store.set(data.traceId, record);
    return record;
  }

  getByTraceId(traceId: string): StoredInvestigation | null {
    return this.store.get(traceId) || null;
  }

  list(options?: { agentName?: string; category?: string; limit?: number }): StoredInvestigation[] {
    let items = Array.from(this.store.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

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

  count(): number {
    return this.store.size;
  }
}

export const inMemoryTraceStore = new InMemoryTraceStore();

/**
 * Save an investigated trace, hypothesis, and generated test into MongoDB Atlas (or in-memory fallback).
 */
export async function saveInvestigation(data: StoredInvestigation): Promise<SaveResult> {
  return startAgentStepSpan(
    {
      stepName: "save_investigation_record",
      op: "gen_ai.data_processing",
      traceId: data.traceId,
      attributes: {
        "db.system": isMongoConfigured() ? "mongodb" : "in_memory",
        "ghosttrace.trace_id": data.traceId,
      },
    },
    async () => {
      const recordToSave = {
        ...data,
        createdAt: data.createdAt || new Date().toISOString(),
      };

      if (!isMongoConfigured()) {
        const saved = inMemoryTraceStore.save(recordToSave);
        recordAgentBreadcrumb("workflow", `Investigation saved to in-memory store (${data.traceId})`, {
          traceId: data.traceId,
          engine: "in_memory",
        });
        return {
          id: saved._id!,
          persisted: true,
          storageEngine: "in_memory",
        };
      }

      const { db } = await connectToDatabase();
      if (!db) {
        const saved = inMemoryTraceStore.save(recordToSave);
        return {
          id: saved._id!,
          persisted: true,
          storageEngine: "in_memory",
        };
      }

      try {
        const collection = db.collection<StoredInvestigation>("investigations");
        const updateResult = await collection.updateOne(
          { traceId: data.traceId },
          { $set: recordToSave },
          { upsert: true }
        );

        const id = updateResult.upsertedId?.toString() || data.traceId;
        recordAgentBreadcrumb("workflow", `Investigation persisted to MongoDB Atlas (${data.traceId})`, {
          traceId: data.traceId,
          engine: "mongodb_atlas",
        });

        return {
          id,
          persisted: true,
          storageEngine: "mongodb_atlas",
        };
      } catch (err) {
        console.warn("Failed to write to MongoDB Atlas, falling back to in-memory store:", err);
        const saved = inMemoryTraceStore.save(recordToSave);
        return {
          id: saved._id!,
          persisted: true,
          storageEngine: "in_memory",
        };
      }
    }
  );
}

/**
 * Retrieve a specific forensic investigation by its unique traceId.
 */
export async function getInvestigationByTraceId(traceId: string): Promise<StoredInvestigation | null> {
  if (!isMongoConfigured()) {
    return inMemoryTraceStore.getByTraceId(traceId);
  }

  const { db } = await connectToDatabase();
  if (!db) {
    return inMemoryTraceStore.getByTraceId(traceId);
  }

  try {
    const collection = db.collection<StoredInvestigation>("investigations");
    const result = await collection.findOne({ traceId });
    return result || inMemoryTraceStore.getByTraceId(traceId);
  } catch {
    return inMemoryTraceStore.getByTraceId(traceId);
  }
}

/**
 * List recent forensic investigations with optional filtering.
 */
export async function listInvestigations(options?: {
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
 * Aggregate forensic failure statistics across all stored agent traces.
 */
export async function getTraceStatistics(): Promise<{
  totalTraces: number;
  failureCategoryCounts: Record<string, number>;
  averageTokens: number;
}> {
  const investigations = await listInvestigations({ limit: 100 });
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
