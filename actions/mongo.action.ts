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

export async function addCampaignRegistration(
  doc: CampaignRegistration,
): Promise<any> {
  try {
    const db = await getMongoConnectionInstance()
    const collection = db.collection('campaign_registrations')
    
    const result = await collection.insertOne({
      ...doc,
      created_at: doc?.created_at || new Date(),
    })
    return result
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error adding campaign registration: " + msg)
    return null
  }
}
