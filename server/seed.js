// npm run seed            -> add/update products, keep existing reservations
// npm run seed -- --reset -> also wipe all reservations and refill stock
import { client, connect } from './db.js'
import { PRODUCTS } from './products.js'

const reset = process.argv.includes('--reset')
const col = await connect()

if (reset) {
  await col.users.deleteMany({})
  await col.clicks.deleteMany({})
  await col.products.updateMany({}, { $set: { reservedCount: 0 } })
}

for (const { _id, ...p } of PRODUCTS) {
  // stock = total minus what's already been reserved, so changing `total` works without a reset
  await col.products.updateOne(
    { _id },
    [
      { $set: { ...p, reservedCount: { $ifNull: ['$reservedCount', 0] } } },
      { $set: { stock: { $max: [0, { $subtract: [p.total, '$reservedCount'] }] } } },
    ],
    { upsert: true }
  )
}

// products removed from the list
const ids = PRODUCTS.map((p) => p._id)
const { deletedCount } = await col.products.deleteMany({ _id: { $nin: ids } })

if (reset) console.log('reservations cleared, stock refilled')
if (deletedCount) console.log(`removed ${deletedCount} old product(s)`)
console.log(`${PRODUCTS.length} products seeded`)
await client.close()
