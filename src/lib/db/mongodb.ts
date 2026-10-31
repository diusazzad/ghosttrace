import { MongoClient, Db } from "mongodb";
import { recordAgentBreadcrumb } from "@/lib/telemetry/sentryTracer";
import dns from "node:dns";

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export class MongoIndexVerificationError extends Error {
  constructor(message: string) {
    super(`[MongoDB Index Verification Failed] ${message}`);
    this.name = "MongoIndexVerificationError";
  }
}

export function isMongoConfigured(): boolean {
  const uri = process.env.MONGODB_URI;
  return Boolean(uri && uri.trim().length > 0 && !uri.includes("your_mongodb_uri_here"));
}

/**
 * Configure and verify MongoDB collections with compound indexes for multi-tenant owner isolation.
 * Fails closed if the required multi-tenant indexes cannot be created or verified.
 */
export async function ensureIndexes(db: Db): Promise<void> {
  const collection = db.collection("investigations");

  // Create required compound indexes
  await collection.createIndex({ ownerId: 1, traceId: 1 }, { unique: true });
  await collection.createIndex({ ownerId: 1, createdAt: -1 });
  await collection.createIndex({ ownerId: 1, primaryFailureCategory: 1 });

  // Verification step: inspect collection indexes to guarantee multi-tenant boundaries exist
  const existingIndexes = await collection.indexes();

  const hasUniqueCompoundIndex = existingIndexes.some((idx) => {
    const key = idx.key as Record<string, number>;
    return key.ownerId === 1 && key.traceId === 1 && idx.unique === true;
  });

  const hasChronoIndex = existingIndexes.some((idx) => {
    const key = idx.key as Record<string, number>;
    return key.ownerId === 1 && key.createdAt === -1;
  });

  if (!hasUniqueCompoundIndex) {
    throw new MongoIndexVerificationError(
      "Missing required unique compound index { ownerId: 1, traceId: 1 }. Refusing to operate in unpartitioned state."
    );
  }

  if (!hasChronoIndex) {
    throw new MongoIndexVerificationError(
      "Missing required chronological compound index { ownerId: 1, createdAt: -1 }."
    );
  }
}

export async function connectToDatabase(): Promise<{ client: MongoClient | null; db: Db | null }> {
  if (!isMongoConfigured()) {
    return { client: null, db: null };
  }

  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const uri = process.env.MONGODB_URI!;
  const dbName = process.env.MONGODB_DB_NAME || "ghosttrace_forensics";

  // On Windows / environments where local resolver refuses SRV queries,
  // configure standard public DNS resolvers for mongodb+srv connections.
  if (process.platform === "win32") {
    try {
      dns.setServers(["8.8.8.8", "1.1.1.1"]);
    } catch {
      // ignore in restricted sandboxes
    }
  }

  try {
    recordAgentBreadcrumb("workflow", "Connecting to MongoDB Atlas cluster", { dbName });
    const client = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });

    await client.connect();
    const db = client.db(dbName);

    // Initialize and verify owner-isolated compound indexes (Fails closed on error)
    await ensureIndexes(db);

    cachedClient = client;
    cachedDb = db;

    recordAgentBreadcrumb("workflow", "Successfully connected and verified MongoDB Atlas indexes", { dbName });
    return { client, db };
  } catch (err) {
    // Fail closed: invalidate any partially initialized connections
    cachedClient = null;
    cachedDb = null;

    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn("MongoDB connection or index verification failed, failing closed to in-memory fallback:", errMsg);
    recordAgentBreadcrumb("workflow", "MongoDB connection or index verification failed", { error: errMsg });
    return { client: null, db: null };
  }
}
