// lib/mongodb.ts
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI!
const options = {}

let client: MongoClient
let mongoClientPromise: Promise<MongoClient>

if (!global._mongoClientPromise) {
  client = new MongoClient(uri, options)
  global._mongoClientPromise = client.connect()
}
mongoClientPromise = global._mongoClientPromise

export default mongoClientPromise

export async function getMongoConnectionInstance() {
  return (await mongoClientPromise).db()
}

export interface CampaignRegistration {
  xUsername: string;
  telegram: string;
  walletAddress: string;
  created_at?: Date;
}

/**
 * Add or update a campaign registration by wallet address (idempotent).
 * If the wallet has already registered, updates their social handles
 * and records the update timestamp rather than inserting a duplicate.
 */
export async function addCampaignRegistration(
  doc: CampaignRegistration,
): Promise<{ upserted: boolean } | null> {
  try {
    const db = await getMongoConnectionInstance()
    const collection = db.collection('campaign_registrations')

    const now = new Date();
    const result = await collection.updateOne(
      { walletAddress: doc.walletAddress },
      {
        $set: {
          xUsername: doc.xUsername,
          telegram: doc.telegram,
          updated_at: now,
        },
        $setOnInsert: {
          created_at: doc.created_at ?? now,
        },
      },
      { upsert: true },
    )

    return { upserted: result.upsertedCount > 0 }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error adding campaign registration: " + msg)
    return null
  }
}
