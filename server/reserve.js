import { client } from './db.js'

/**
 * "Same time" rule
 * ----------------
 * The first click on a product opens a TIE_WINDOW_MS window. Every click that
 * arrives in that window joins the same batch. When the window closes:
 *   - stock is 0                       -> everyone: sold out (nothing is saved)
 *   - more people than stock left      -> TIE: nobody gets it, everyone retries
 *     (with STRICT_TIE, ANY 2+ people  -> TIE, even if there's enough stock)
 *   - otherwise                        -> everyone wins, ordered by click time
 *
 * Batches for the same product are resolved one after another (queue), and the
 * stock decrement is conditional (`stock >= n`) inside a transaction, so stock
 * can never go below 0 and a user's list only ever gets products they won.
 *
 * Needs ONE server process (batches live in memory), don't run multiple instances.
 */
export const TIE_WINDOW_MS = 500
export const STRICT_TIE = false

const batches = new Map() // productId -> { clicks: [], done: Promise<Map> }
const queues = new Map() // productId -> Promise (serialises resolution per product)
let seq = 0

function enqueue(productId, fn) {
  const prev = queues.get(productId) || Promise.resolve()
  const next = prev.then(fn, fn)
  queues.set(productId, next.catch(() => {}))
  return next
}

export function createReserver(col, onChange) {
  async function reserve(productId, username) {
    const lower = username.toLowerCase()

    // fast rejects, never recorded anywhere
    const product = await col.products.findOne({ _id: productId })
    if (!product) return { status: 'error', message: 'ไม่พบสินค้า' }
    if (product.stock <= 0) return { status: 'soldout' }
    const has = await col.users.findOne({ usernameLower: lower, 'products.productId': productId })
    if (has) return { status: 'already' }

    let b = batches.get(productId)
    if (!b) {
      b = { clicks: [] }
      b.done = new Promise((r) => setTimeout(r, TIE_WINDOW_MS)).then(() => {
        batches.delete(productId)
        return enqueue(productId, () => resolveBatch(productId, b.clicks))
      })
      batches.set(productId, b)
    }
    b.clicks.push({ username, lower, at: new Date(), seq: seq++ })
    const results = await b.done
    return results.get(lower)
  }

  async function resolveBatch(productId, clicks) {
    const results = new Map()

    // one entry per person (double clicks collapse to their first click)
    const seen = new Set()
    let people = clicks
      .sort((a, b) => a.seq - b.seq)
      .filter((c) => (seen.has(c.lower) ? false : seen.add(c.lower)))

    const owners = await col.users
      .find({ usernameLower: { $in: people.map((p) => p.lower) }, 'products.productId': productId })
      .project({ usernameLower: 1 })
      .toArray()
    const ownerSet = new Set(owners.map((o) => o.usernameLower))
    for (const p of people) if (ownerSet.has(p.lower)) results.set(p.lower, { status: 'already' })
    people = people.filter((p) => !ownerSet.has(p.lower))
    if (people.length === 0) return results

    const product = await col.products.findOne({ _id: productId })
    const n = people.length

    if (product.stock <= 0) {
      for (const p of people) results.set(p.lower, { status: 'soldout' })
      return results
    }

    if (n > product.stock || (STRICT_TIE && n > 1)) {
      const names = people.map((p) => p.username)
      for (const p of people) results.set(p.lower, { status: 'tie', tiedWith: names, stockLeft: product.stock })
      await col.clicks.insertOne({
        productId, productName: product.name, status: 'tie', users: names,
        at: people[0].at, windowMs: TIE_WINDOW_MS,
      })
      onChange()
      return results
    }

    // everyone in the batch fits -> all win, in click order
    const session = client.startSession()
    try {
      await session.withTransaction(async () => {
        const before = await col.products.findOneAndUpdate(
          { _id: productId, stock: { $gte: n } },
          { $inc: { stock: -n, reservedCount: n } },
          { session, returnDocument: 'before' }
        )
        if (!before) throw new Error('STOCK_CHANGED')

        for (let i = 0; i < n; i++) {
          const p = people[i]
          const entry = { productId, name: product.name, order: before.reservedCount + i + 1, clickedAt: p.at }
          await col.users.updateOne(
            { usernameLower: p.lower },
            { $push: { products: entry }, $setOnInsert: { username: p.username, createdAt: new Date() } },
            { session, upsert: true }
          )
          results.set(p.lower, { status: 'won', order: entry.order })
        }
        await col.clicks.insertOne(
          { productId, productName: product.name, status: 'won', users: people.map((p) => p.username), at: people[0].at },
          { session }
        )
      })
    } catch (e) {
      console.error('reserve failed', e)
      for (const p of people) results.set(p.lower, { status: 'error', message: 'ลองใหม่อีกครั้ง' })
    } finally {
      await session.endSession()
    }
    onChange()
    return results
  }

  return reserve
}
