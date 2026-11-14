import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { connect } from './db.js'
import { createReserver, TIE_WINDOW_MS } from './reserve.js'
import { limit, issueToken, readToken, verifyCaptcha } from './guard.js'

const col = await connect()
const app = express()
// Behind Render/Railway/Cloudflare etc. set TRUST_PROXY=1 so req.ip is the real visitor IP.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1)
app.disable('x-powered-by')
app.use(express.json({ limit: '4kb' }))

const USERNAME_RE = /^[A-Za-z0-9_]{1,15}$/
const cleanName = (s) => String(s ?? '').trim().replace(/^@+/, '')

function tooMany(res, retryAfter) {
  res.set('Retry-After', String(retryAfter))
  return res.status(429).json({ status: 'ratelimited', retryAfter, error: 'too many requests' })
}

// ---------- cached state: many viewers -> one Mongo read ----------
let stateCache = null // Promise
let stateAt = 0
function getState() {
  if (!stateCache || Date.now() - stateAt > 5000) {
    stateAt = Date.now()
    stateCache = Promise.all([
      col.products.find().sort({ sort: 1 }).toArray(),
      col.users.find({ 'products.0': { $exists: true } }, { projection: { _id: 0, username: 1, products: 1 } }).toArray(),
      col.clicks.find().sort({ at: -1 }).limit(50).toArray(),
    ]).then(([products, users, log]) => ({ products, users, log, tieWindowMs: TIE_WINDOW_MS }))
    stateCache.catch(() => { stateCache = null })
  }
  return stateCache
}

// ---------- live updates (Server-Sent Events) ----------
const streams = new Set()
const streamsPerIp = new Map()
const MAX_STREAMS_PER_IP = 6
let pending = null
function broadcast() {
  stateCache = null
  clearTimeout(pending)
  pending = setTimeout(() => {
    for (const res of streams) res.write('data: update\n\n')
  }, 150)
}
app.get('/api/stream', (req, res) => {
  const n = streamsPerIp.get(req.ip) || 0
  if (n >= MAX_STREAMS_PER_IP) return tooMany(res, 30)
  streamsPerIp.set(req.ip, n + 1)

  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
  res.flushHeaders()
  res.write('retry: 3000\ndata: hello\n\n')
  streams.add(res)
  const ping = setInterval(() => res.write(': ping\n\n'), 25000)
  req.on('close', () => {
    clearInterval(ping)
    streams.delete(res)
    const left = (streamsPerIp.get(req.ip) || 1) - 1
    left ? streamsPerIp.set(req.ip, left) : streamsPerIp.delete(req.ip)
  })
})

const reserve = createReserver(col, broadcast)

// ---------- routes ----------
app.post('/api/login', async (req, res) => {
  const wait = limit('login', req.ip)
  if (wait) return tooMany(res, wait)

  // honeypot: humans never see/fill this field
  if (req.body.website) return res.status(400).json({ error: 'bot' })

  const username = cleanName(req.body.username)
  if (!USERNAME_RE.test(username)) return res.status(400).json({ error: 'invalid twitter name' })
  if (!(await verifyCaptcha(req.body.captcha, req.ip))) return res.status(403).json({ error: 'captcha' })

  const user = await col.users.findOneAndUpdate(
    { usernameLower: username.toLowerCase() },
    { $setOnInsert: { username, usernameLower: username.toLowerCase(), products: [], createdAt: new Date() } },
    { upsert: true, returnDocument: 'after' }
  )
  res.json({ username: user.username, token: issueToken(user.username) })
})

app.get('/api/state', async (req, res) => {
  const wait = limit('state', req.ip)
  if (wait) return tooMany(res, wait)
  res.json(await getState())
})

app.post('/api/reserve', async (req, res) => {
  const username = readToken(req.get('x-session'))
  if (!username) return res.status(401).json({ status: 'relogin' })

  const wait = limit('reserveIp', req.ip) || limit('reserveUser', username.toLowerCase())
  if (wait) return tooMany(res, wait)

  const productId = String(req.body.productId ?? '').slice(0, 40)
  try {
    res.json(await reserve(productId, username))
  } catch (e) {
    console.error(e)
    res.status(500).json({ status: 'error', message: 'server error' })
  }
})

app.use('/api', (_req, res) => res.status(404).json({ error: 'not found' }))

// ---------- serve the built frontend in production ----------
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
app.use(express.static(dist))
app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')))

const port = process.env.PORT || 3001
app.listen(port, () => console.log(`server on http://localhost:${port}`))
