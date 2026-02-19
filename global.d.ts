import { MongoClient } from "mongodb";

declare global {
  // Persisted MongoDB client promise across hot-reloads in Next.js dev mode
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}
