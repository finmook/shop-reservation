// npm run seed            → add/update products (keeps existing reservations)
// npm run seed -- --reset → ALSO wipe all reservations and refill stock
import { client, connect } from './db.js'
import { PRODUCTS } from './products.js'

const reset = process.argv.includes('--reset')
const col = await connect()

for (const { total, ...p } of PRODUCTS) {
  await col.products.updateOne(
    { _id: p._id },
    { $set: { ...p, total }, $setOnInsert: { stock: total, reservedCount: 0 } },
    { upsert: true }
  )
}

if (reset) {
  for (const p of PRODUCTS) {
    await col.products.updateOne({ _id: p._id }, { $set: { stock: p.total, reservedCount: 0 } })
  }
  await col.users.deleteMany({})
  await col.clicks.deleteMany({})
  console.log('🧹 reservations cleared, stock refilled')
}

console.log(`✅ ${PRODUCTS.length} products seeded`)
await client.close()
