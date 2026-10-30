import { MongoClient, Db } from "mongodb";
import { recordAgentBreadcrumb } from "@/lib/telemetry/sentryTracer";

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export function isMongoConfigured(): boolean {
  const uri = process.env.MONGODB_URI;
  return Boolean(uri && uri.trim().length > 0 && !uri.includes("your_mongodb_uri_here"));
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

  try {
    recordAgentBreadcrumb("workflow", "Connecting to MongoDB Atlas cluster", { dbName });
    const client = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 3000,
    });

    await client.connect();
    const db = client.db(dbName);

    // Initialize indexes for high performance querying
    await db.collection("investigations").createIndex({ traceId: 1 }, { unique: true });
    await db.collection("investigations").createIndex({ createdAt: -1 });
    await db.collection("investigations").createIndex({ primaryFailureCategory: 1 });

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
