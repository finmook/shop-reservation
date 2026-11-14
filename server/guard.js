import crypto from 'node:crypto'

// ---------------------------------------------------------------------------
// Rate limiter (fixed window, in memory) + "strikes" -> temporary block
// ---------------------------------------------------------------------------
const hits = new Map() // key -> { count, reset }
const strikes = new Map() // key -> { count, reset }
const blocked = new Map() // key -> until (ms)

export const LIMITS = {
  login: { max: 10, windowMs: 10 * 60_000 }, // per IP
  reserveUser: { max: 6, windowMs: 10_000 }, // per user
  reserveIp: { max: 30, windowMs: 10_000 }, // per IP (shared wifi friendly)
  state: { max: 40, windowMs: 10_000 }, // per IP
}
const STRIKES_TO_BLOCK = 3 // hit a limit 3 times within a minute
const BLOCK_MS = 2 * 60_000 // ...then blocked for 2 minutes

/** Returns 0 if allowed, otherwise seconds until the caller may retry. */
export function limit(kind, id) {
  const now = Date.now()
  const key = `${kind}:${id}`

  const until = blocked.get(id)
  if (until && until > now) return Math.ceil((until - now) / 1000)

  const { max, windowMs } = LIMITS[kind]
  let h = hits.get(key)
  if (!h || h.reset <= now) h = { count: 0, reset: now + windowMs }
  h.count++
  hits.set(key, h)
  if (h.count <= max) return 0

  // over the limit: count a strike (once per window)
  if (h.count === max + 1) {
    let s = strikes.get(id)
    if (!s || s.reset <= now) s = { count: 0, reset: now + 60_000 }
    s.count++
    strikes.set(id, s)
    if (s.count >= STRIKES_TO_BLOCK) {
      blocked.set(id, now + BLOCK_MS)
      console.warn(`blocked ${id} for ${BLOCK_MS / 1000}s`)
      return BLOCK_MS / 1000
    }
  }
  return Math.ceil((h.reset - now) / 1000)
}

setInterval(() => {
  const now = Date.now()
  for (const [k, v] of hits) if (v.reset <= now) hits.delete(k)
  for (const [k, v] of strikes) if (v.reset <= now) strikes.delete(k)
  for (const [k, v] of blocked) if (v <= now) blocked.delete(k)
}, 60_000).unref()

// ---------------------------------------------------------------------------
// Signed session token: the server decides who you are, not the request body
// ---------------------------------------------------------------------------
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex')
if (!process.env.SESSION_SECRET) {
  console.warn('SESSION_SECRET not set, using a random one (everyone has to log in again after a restart)')
}
const TOKEN_TTL_MS = 12 * 60 * 60_000

const sign = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('base64url')

export function issueToken(username) {
  const payload = Buffer.from(JSON.stringify({ u: username, t: Date.now() })).toString('base64url')
  return `${payload}.${sign(payload)}`
}

/** Returns the username, or null if the token is missing/forged/expired. */
export function readToken(token) {
  if (typeof token !== 'string') return null
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return null
  const expected = sign(payload)
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  try {
    const { u, t } = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return Date.now() - t < TOKEN_TTL_MS ? u : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Cloudflare Turnstile (optional, enabled when TURNSTILE_SECRET is set)
// ---------------------------------------------------------------------------
export const captchaEnabled = Boolean(process.env.TURNSTILE_SECRET)

export async function verifyCaptcha(token, ip) {
  if (!captchaEnabled) return true
  if (!token) return false
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET, response: token, remoteip: ip }),
    })
    return (await r.json()).success === true
  } catch (e) {
    console.error('turnstile verify failed', e)
    return false
  }
}
