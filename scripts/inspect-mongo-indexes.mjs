/**
 * Safe, read-only inspection script for MongoDB Atlas indexes and unowned documents.
 * Never performs index modifications, drops, or writes.
 */
import { MongoClient } from "mongodb";

export const UNOWNED_OR_INVALID_OWNER_FILTER = {
  $or: [
    { ownerId: { $exists: false } },
    { ownerId: null },
    { ownerId: { $not: { $type: "string" } } },
    { ownerId: { $regex: /^\s*$/ } },
  ],
};

export async function inspectLiveAtlas() {
  console.log("=== MongoDB Atlas Read-Only Index & Document Inspection ===");

  const uri = process.env.MONGODB_URI;
  if (!uri || uri.trim().length === 0 || uri.includes("your-cluster") || uri.includes("your_")) {
    console.error("[INSPECTION BLOCKED] MONGODB_URI environment variable is missing or unconfigured.");
    console.error("Reason: No valid MongoDB connection string present in environment or .env.local.");
    console.error("Result: Live database inspection cannot proceed without credentials.");
    return {
      status: "blocked",
      reason: "Missing or placeholder MONGODB_URI",
    };
  }

  const redactedUri = uri.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@.+)/, "$1********$3");
  console.log(`Connecting to: ${redactedUri}`);

  const client = new MongoClient(uri, {
    connectTimeoutMS: 5000,
    serverSelectionTimeoutMS: 5000,
  });

  try {
    await client.connect();
    const dbName = process.env.MONGODB_DATABASE || "ghosttrace";
    const db = client.db(dbName);
    const collection = db.collection("investigations");

    const indexes = await collection.indexes();
    console.log(`Found ${indexes.length} indexes on 'investigations' collection:`);
    for (const idx of indexes) {
      console.log(` - Name: ${idx.name}, Key: ${JSON.stringify(idx.key)}, Unique: ${Boolean(idx.unique)}`);
    }

    const unownedCount = await collection.countDocuments(UNOWNED_OR_INVALID_OWNER_FILTER);
    console.log(`Unowned / Invalid Owner Documents: ${unownedCount}`);

    console.log("=== Read-Only Inspection Completed Successfully ===");
    return {
      status: "inspected",
      redactedUri,
      indexes,
      unownedCount,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[INSPECTION FAILED] Error querying Atlas: ${errorMsg}`);
    return {
      status: "failed",
      error: errorMsg,
    };
  } finally {
    await client.close();
  }
}

if (process.argv[1] && process.argv[1].includes("inspect-mongo-indexes")) {
  inspectLiveAtlas().then((res) => {
    if (res.status === "inspected") {
      process.exit(0);
    } else {
      process.exit(1);
    }
  });
}
