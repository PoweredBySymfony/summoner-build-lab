import { env } from "../config/env.js";

type MongoDatabase = {
  collection: (name: string) => {
    updateOne: (filter: object, update: object, options?: object) => Promise<unknown>;
    findOne: (filter: object) => Promise<Record<string, unknown> | null>;
  };
  command: (command: object) => Promise<unknown>;
};

type MongoClientLike = {
  db: (name: string) => MongoDatabase;
  close: () => Promise<void>;
};

let clientPromise: Promise<MongoClientLike | null> | null = null;

export function isMongoConfigured() {
  return Boolean(env.MONGODB_URL?.trim());
}

async function createMongoClient() {
  if (!isMongoConfigured()) {
    return null;
  }

  const mongodb = await import("mongodb");
  const client = new mongodb.MongoClient(env.MONGODB_URL!, {
    maxPoolSize: 10,
  });
  await client.connect();
  return client as unknown as MongoClientLike;
}

export async function getMongoClient() {
  if (!clientPromise) {
    clientPromise = createMongoClient().catch((error) => {
      clientPromise = null;
      throw error;
    });
  }
  return clientPromise;
}

export async function getMongoDb() {
  const client = await getMongoClient();
  return client?.db(env.MONGODB_DB_NAME) ?? null;
}

export async function getMongoHealth() {
  const db = await getMongoDb();
  if (!db) {
    return { configured: false, ok: false };
  }

  try {
    await db.command({ ping: 1 });
    return { configured: true, ok: true };
  } catch {
    return { configured: true, ok: false };
  }
}

export async function closeMongoClient() {
  const client = await clientPromise;
  clientPromise = null;
  await client?.close();
}
