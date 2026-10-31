import { connectToDatabase, isMongoConfigured } from "./mongodb";
import { GemmaHypothesis } from "@/lib/ai/gemmaAdapter";
import { recordAgentBreadcrumb, startAgentStepSpan } from "@/lib/telemetry/sentryTracer";

export const DEFAULT_ANONYMOUS_OWNER = "sandbox_anonymous";

export interface StoredInvestigation {
  _id?: string;
  ownerId: string; // Strictly required: verified Auth0 subject (session.user.sub) or isolated demo ID
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
 * Partitions storage strictly by ownerId. Unscoped multi-tenant queries are forbidden.
 */
class InMemoryTraceStore {
  private store: Map<string, StoredInvestigation> = new Map();

  private makeKey(ownerId: string, traceId: string): string {
    return `${ownerId.trim()}:${traceId.trim()}`;
  }

  save(data: StoredInvestigation): StoredInvestigation {
    const ownerId = data.ownerId?.trim();
    if (!ownerId) {
      throw new Error("InMemoryTraceStore.save requires a non-empty ownerId");
    }

    const record: StoredInvestigation = {
      ...data,
      ownerId,
      _id: data._id || `mem_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    };
    this.store.set(this.makeKey(ownerId, data.traceId), record);
    return record;
  }

  getByTraceId(traceId: string, ownerId: string): StoredInvestigation | null {
    if (!ownerId || !ownerId.trim()) {
      throw new Error("InMemoryTraceStore.getByTraceId requires a non-empty ownerId");
    }
    return this.store.get(this.makeKey(ownerId, traceId)) || null;
  }

  list(options: {
    ownerId: string;
    agentName?: string;
    category?: string;
    limit?: number;
  }): StoredInvestigation[] {
    const ownerId = options.ownerId?.trim();
    if (!ownerId) {
      throw new Error("InMemoryTraceStore.list requires a non-empty ownerId");
    }

    let items = Array.from(this.store.values())
      .filter((i) => i.ownerId === ownerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (options.agentName) {
      items = items.filter((i) => i.agentName.toLowerCase() === options.agentName!.toLowerCase());
    }

    if (options.category) {
      items = items.filter((i) => i.primaryFailureCategory === options.category);
    }

    if (options.limit && options.limit > 0) {
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
 * Save an investigated trace, hypothesis, and generated test.
 *
 * Rules:
 * 1. ownerId is mandatory for every record.
 * 2. Anonymous / demo traces are NEVER persisted to MongoDB Atlas (saved to in-memory only).
 * 3. Only verified tenant traces (e.g. auth0|...) are persisted to MongoDB Atlas.
 * 4. Persisted flag is FALSE for in-memory volatile storage; TRUE only for MongoDB Atlas.
 */
export async function saveInvestigation(data: StoredInvestigation): Promise<SaveResult> {
  const ownerId = data.ownerId?.trim();
  if (!ownerId) {
    throw new Error("saveInvestigation requires a non-empty ownerId");
  }

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

      // Guard: Anonymous shared-owner writes are strictly barred from cloud database
      const isAnonymousOrDemo = ownerId === DEFAULT_ANONYMOUS_OWNER || ownerId.startsWith("demo_");
      if (isAnonymousOrDemo || !isMongoConfigured()) {
        const saved = inMemoryTraceStore.save(recordToSave);
        recordAgentBreadcrumb("workflow", `Investigation stored in volatile in-memory store (${data.traceId})`, {
          traceId: data.traceId,
          ownerId,
          engine: "in_memory",
        });
        return {
          id: saved._id!,
          persisted: false, // Volatile in-memory storage is not durable
          storageEngine: "in_memory",
          ownerId,
        };
      }

      const { db } = await connectToDatabase();
      if (!db) {
        // Database connection failed; fail safe to in-memory store
        const saved = inMemoryTraceStore.save(recordToSave);
        return {
          id: saved._id!,
          persisted: false,
          storageEngine: "in_memory",
          ownerId,
        };
      }

      try {
        const collection = db.collection<StoredInvestigation>("investigations");
        // Scoped update partitioned by BOTH ownerId and traceId
        const updateResult = await collection.updateOne(
          { ownerId, traceId: data.traceId },
          { $set: recordToSave },
          { upsert: true }
        );

        const id = updateResult.upsertedId?.toString() || data.traceId;
        recordAgentBreadcrumb("workflow", `Investigation durably persisted to MongoDB Atlas (${data.traceId})`, {
          traceId: data.traceId,
          ownerId,
          engine: "mongodb_atlas",
        });

        return {
          id,
          persisted: true, // Durably persisted to MongoDB Atlas
          storageEngine: "mongodb_atlas",
          ownerId,
        };
      } catch (err) {
        console.warn("Failed to write to MongoDB Atlas, falling back to in-memory store:", err);
        const saved = inMemoryTraceStore.save(recordToSave);
        return {
          id: saved._id!,
          persisted: false,
          storageEngine: "in_memory",
          ownerId,
        };
      }
    }
  );
}

/**
 * Retrieve a specific forensic investigation by traceId, strictly scoped to ownerId.
 * Access is strictly denied (returns null) if the trace belongs to another owner or ownerId is omitted.
 */
export async function getInvestigationByTraceId(
  traceId: string,
  ownerId: string
): Promise<StoredInvestigation | null> {
  const cleanOwnerId = ownerId?.trim();
  if (!cleanOwnerId) {
    throw new Error("getInvestigationByTraceId requires a non-empty ownerId");
  }

  if (!isMongoConfigured() || cleanOwnerId === DEFAULT_ANONYMOUS_OWNER || cleanOwnerId.startsWith("demo_")) {
    return inMemoryTraceStore.getByTraceId(traceId, cleanOwnerId);
  }

  const { db } = await connectToDatabase();
  if (!db) {
    return inMemoryTraceStore.getByTraceId(traceId, cleanOwnerId);
  }

  try {
    const collection = db.collection<StoredInvestigation>("investigations");
    // Strict compound query guaranteeing horizontal isolation
    const result = await collection.findOne({ ownerId: cleanOwnerId, traceId });
    return result || inMemoryTraceStore.getByTraceId(traceId, cleanOwnerId);
  } catch {
    return inMemoryTraceStore.getByTraceId(traceId, cleanOwnerId);
  }
}

/**
 * List recent forensic investigations with optional filtering, strictly scoped by ownerId.
 */
export async function listInvestigations(options: {
  ownerId: string;
  agentName?: string;
  category?: string;
  limit?: number;
}): Promise<StoredInvestigation[]> {
  const cleanOwnerId = options.ownerId?.trim();
  if (!cleanOwnerId) {
    throw new Error("listInvestigations requires a non-empty ownerId");
  }

  const limit = options.limit ?? 20;

  if (!isMongoConfigured() || cleanOwnerId === DEFAULT_ANONYMOUS_OWNER || cleanOwnerId.startsWith("demo_")) {
    return inMemoryTraceStore.list({ ...options, ownerId: cleanOwnerId });
  }

  const { db } = await connectToDatabase();
  if (!db) {
    return inMemoryTraceStore.list({ ...options, ownerId: cleanOwnerId });
  }

  try {
    const filter: Record<string, unknown> = {
      ownerId: cleanOwnerId, // Mandatory multi-tenant boundary
    };

    if (options.agentName) {
      filter.agentName = { $regex: new RegExp(options.agentName, "i") };
    }
    if (options.category) {
      filter.primaryFailureCategory = options.category;
    }

    const collection = db.collection<StoredInvestigation>("investigations");
    const docs = await collection.find(filter).sort({ createdAt: -1 }).limit(limit).toArray();

    if (docs.length === 0) {
      return inMemoryTraceStore.list({ ...options, ownerId: cleanOwnerId });
    }

    return docs.map((d) => ({
      ...d,
      _id: d._id ? d._id.toString() : undefined,
    }));
  } catch {
    return inMemoryTraceStore.list({ ...options, ownerId: cleanOwnerId });
  }
}

/**
 * Aggregate forensic failure statistics across stored agent traces, strictly scoped to ownerId.
 */
export async function getTraceStatistics(ownerId: string): Promise<{
  totalTraces: number;
  failureCategoryCounts: Record<string, number>;
  averageTokens: number;
}> {
  const cleanOwnerId = ownerId?.trim();
  if (!cleanOwnerId) {
    throw new Error("getTraceStatistics requires a non-empty ownerId");
  }

  const investigations = await listInvestigations({ ownerId: cleanOwnerId, limit: 100 });
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
