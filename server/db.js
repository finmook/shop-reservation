import { MongoClient } from 'mongodb'

if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI is missing — copy .env.example to .env and fill it in.')
  process.exit(1)
}

export const client = new MongoClient(process.env.MONGODB_URI)

export async function connect() {
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'shop')
  const col = {
    products: db.collection('products'),
    // { username, usernameLower, products: [{ productId, name, order, clickedAt }] }
    users: db.collection('reservation'),
    // log of tie rounds + wins, for the dashboard
    clicks: db.collection('clicks'),
  }
  await col.users.createIndex({ usernameLower: 1 }, { unique: true })
  await col.clicks.createIndex({ at: -1 })
  return col
}
