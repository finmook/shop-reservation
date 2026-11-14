import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { connect } from './db.js'
import { createReserver, TIE_WINDOW_MS } from './reserve.js'
import { limit, issueToken, readSession, verifyCaptcha, isAdmin, checkAdminPassword } from './guard.js'

const col = await connect()
const app = express()
// Behind Render/Railway/Cloudflare etc. set TRUST_PROXY=1 so req.ip is the real visitor IP.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1)
app.disable('x-powered-by')
app.use(express.json({ limit: '4kb' }))

// The site can be hosted separately (Cloudflare Pages). List its URL(s) in ALLOWED_ORIGINS,
// e.g. ALLOWED_ORIGINS=https://shop-reservation.pages.dev
const ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean)
app.use('/api', (req, res, next) => {
  const origin = req.get('origin')
  if (origin && ORIGINS.includes(origin)) {
    res.set({
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Session',
      'Access-Control-Max-Age': '600',
      Vary: 'Origin',
    })
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

// cheap check used by the "waking up" page and the keep-alive ping (no DB call)
app.get('/api/health', (_req, res) => res.json({ ok: true }))

const USERNAME_RE = /^[A-Za-z0-9_]{1,15}$/
const cleanName = (s) => String(s ?? '').trim().replace(/^@+/, '')

function tooMany(res, retryAfter) {
  res.set('Retry-After', String(retryAfter))
  return res.status(429).json({ status: 'ratelimited', retryAfter, error: 'too many requests' })
}

// ---------- cached reads: many viewers -> one Mongo read ----------
function cached(load) {
  let p = null
  let at = 0
  const get = () => {
    if (!p || Date.now() - at > 5000) {
      at = Date.now()
      p = load()
      p.catch(() => { p = null })
    }
    return p
  }
  get.clear = () => { p = null }
  return get
}

// public: products and stock only
const getState = cached(async () => ({
  products: await col.products.find().sort({ sort: 1 }).toArray(),
  tieWindowMs: TIE_WINDOW_MS,
}))

// admin only: who reserved what + tie log
const getAdmin = cached(async () => {
  const [users, log] = await Promise.all([
    col.users.find({ 'products.0': { $exists: true } }, { projection: { _id: 0, username: 1, products: 1 } }).toArray(),
    col.clicks.find().sort({ at: -1 }).limit(50).toArray(),
  ])
  return { users, log }
})

// ---------- live updates (Server-Sent Events) ----------
const streams = new Set()
const streamsPerIp = new Map()
const MAX_STREAMS_PER_IP = 6
let pending = null
function broadcast() {
  getState.clear()
  getAdmin.clear()
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

  // admin names need a password (checked before the captcha so the captcha token isn't used up)
  const admin = isAdmin(username)
  if (admin) {
    if (!req.body.password) return res.status(401).json({ error: 'admin_password' })
    if (!checkAdminPassword(req.body.password)) return res.status(401).json({ error: 'wrong_password' })
  }

  if (!(await verifyCaptcha(req.body.captcha, req.ip))) return res.status(403).json({ error: 'captcha' })

  const user = await col.users.findOneAndUpdate(
    { usernameLower: username.toLowerCase() },
    { $setOnInsert: { username, usernameLower: username.toLowerCase(), products: [], createdAt: new Date() } },
    { upsert: true, returnDocument: 'after' }
  )
  res.json({ username: user.username, admin, token: issueToken(user.username, admin) })
})

app.get('/api/state', async (req, res) => {
  const wait = limit('state', req.ip)
  if (wait) return tooMany(res, wait)
  res.json(await getState())
})

// the logged-in customer's own reservations
app.get('/api/me', async (req, res) => {
  const s = readSession(req.get('x-session'))
  if (!s) return res.status(401).json({ error: 'relogin' })
  const wait = limit('state', req.ip)
  if (wait) return tooMany(res, wait)
  const u = await col.users.findOne({ usernameLower: s.username.toLowerCase() }, { projection: { _id: 0, products: 1 } })
  res.json({ products: u?.products ?? [] })
})

app.get('/api/admin', async (req, res) => {
  const s = readSession(req.get('x-session'))
  if (!s?.admin) return res.status(403).json({ error: 'admin only' })
  res.json(await getAdmin())
})

app.post('/api/reserve', async (req, res) => {
  const username = readSession(req.get('x-session'))?.username
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
