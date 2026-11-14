// Empty when the site and API are on the same server (local dev, or Render alone).
// Set VITE_API_URL=https://xxx.onrender.com when the site is hosted on Cloudflare Pages.
const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

const SESSION_KEY = 'session'

export function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
    return s?.username && s?.token ? s : null
  } catch {
    return null
  }
}
export function saveSession(s) {
  try { s ? localStorage.setItem(SESSION_KEY, JSON.stringify(s)) : localStorage.removeItem(SESSION_KEY) } catch {}
}

async function post(path, body, token) {
  const r = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Session': token } : {}) },
    body: JSON.stringify(body),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok && !data.status) {
    const err = new Error(data.error || `HTTP ${r.status}`)
    err.code = data.error
    throw err
  }
  return data
}

export const login = (username, captcha, website) => post('/api/login', { username, captcha, website })
export const reserve = (productId, token) => post('/api/reserve', { productId }, token)

/** true if the server answers within `timeoutMs` */
export async function ping(timeoutMs = 5000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await fetch(`${API}/api/health`, { signal: ctrl.signal, cache: 'no-store' })
    return r.ok && (await r.json()).ok === true
  } catch {
    return false
  } finally {
    clearTimeout(t)
  }
}

/** Load state and refresh whenever the server says something changed. */
export function subscribeState(onChange) {
  let alive = true
  let timer = null
  const load = () => {
    clearTimeout(timer) // collapse bursts of updates into one request
    timer = setTimeout(async () => {
      try {
        const r = await fetch(`${API}/api/state`)
        if (r.status === 429) return
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const data = await r.json()
        if (alive) onChange({ ...data, error: null })
      } catch (e) {
        if (alive) onChange({ error: e })
      }
    }, 100 + Math.random() * 300) // jitter so everyone doesn't hit the server at once
  }
  const es = new EventSource(`${API}/api/stream`)
  es.onmessage = load // first message ("hello") triggers the initial load
  return () => { alive = false; clearTimeout(timer); es.close() }
}

export const baht = (n) => `${Number(n).toLocaleString('th-TH')} บาท`

export function fmtTime(ts) {
  if (!ts) return '-'
  const d = new Date(ts)
  const p = (n, l = 2) => String(n).padStart(l, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`
}
