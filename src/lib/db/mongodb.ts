import { MongoClient, Db } from "mongodb";
import { recordAgentBreadcrumb } from "@/lib/telemetry/sentryTracer";
import dns from "node:dns";

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export function isMongoConfigured(): boolean {
  const uri = process.env.MONGODB_URI;
  return Boolean(uri && uri.trim().length > 0 && !uri.includes("your_mongodb_uri_here"));
}

/**
 * Configure MongoDB collections with compound indexes for multi-tenant owner isolation.
 */
export async function ensureIndexes(db: Db): Promise<void> {
  const collection = db.collection("investigations");
  try {
    // Compound unique index ensuring each traceId is partitioned per ownerId
    await collection.createIndex({ ownerId: 1, traceId: 1 }, { unique: true });
    // Compound index for fast chronological sorting per owner
    await collection.createIndex({ ownerId: 1, createdAt: -1 });
    // Compound index for filtering by failure category per owner
    await collection.createIndex({ ownerId: 1, primaryFailureCategory: 1 });
  } catch (indexErr) {
    console.warn("Notice: index creation notice (may already exist):", indexErr);
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

    // Initialize owner-isolated compound indexes
    await ensureIndexes(db);

    cachedClient = client;
    cachedDb = db;

    recordAgentBreadcrumb("workflow", "Successfully connected to MongoDB Atlas", { dbName });
    return { client, db };
  } catch (err) {
    console.warn("MongoDB connection failed, falling back to in-memory store:", err);
    recordAgentBreadcrumb("workflow", "MongoDB connection failed, using in-memory store", { error: String(err) });
    return { client: null, db: null };
  }
}
