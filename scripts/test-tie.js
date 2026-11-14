// Simulate several people clicking "จอง" at the same moment.
//
//   npm run test:tie                          -> 2 people click Nurse Usagi together
//   npm run test:tie -- chiikawa              -> choose the product id
//   npm run test:tie -- chiikawa 3            -> 3 people
//   npm run test:tie -- chiikawa 2 300        -> 2 people, 300 ms apart (still a tie: < 500 ms)
//   npm run test:tie -- chiikawa 2 700        -> 700 ms apart (NOT a tie: first one wins)
//
// Needs `npm run dev` (or `npm run server`) running. Uses SESSION_SECRET from .env
// to make login tokens for fake users test_1, test_2, ...
// Afterwards clean up with:  npm run seed -- --reset
import { issueToken } from '../server/guard.js'

const [productId = 'usagi', count = '2', gapMs = '0'] = process.argv.slice(2)
const API = `http://localhost:${process.env.PORT || 3001}`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

if (!process.env.SESSION_SECRET) {
  console.error('Set SESSION_SECRET in .env first (the server and this script must share it).')
  process.exit(1)
}

const users = Array.from({ length: Number(count) }, (_, i) => `test_${i + 1}`)
console.log(`${users.join(", ")} -> "${productId}", ${gapMs} ms apart\n`)

const results = await Promise.all(
  users.map(async (u, i) => {
    await sleep(i * Number(gapMs))
    const t0 = Date.now()
    const r = await fetch(`${API}/api/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Session': issueToken(u) },
      body: JSON.stringify({ productId }),
    }).then((r) => r.json())
    return { u, r, ms: Date.now() - t0 }
  })
)

for (const { u, r, ms } of results) {
  console.log(`@${u.padEnd(8)} ${r.status.padEnd(11)} ${r.order ? `#${r.order} ` : ''}${r.tiedWith ? `(tied with ${r.tiedWith.join(', ')}) ` : ''}${r.message ?? ''}(${ms} ms)`)
}
console.log('\nclean up test data:  npm run seed -- --reset')
