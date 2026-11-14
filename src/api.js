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

async function post(url, body, token) {
  const r = await fetch(url, {
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

/** Load state and refresh whenever the server says something changed. */
export function subscribeState(onChange) {
  let alive = true
  let timer = null
  const load = () => {
    clearTimeout(timer) // collapse bursts of updates into one request
    timer = setTimeout(async () => {
      try {
        const r = await fetch('/api/state')
        if (r.status === 429) return
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const data = await r.json()
        if (alive) onChange({ ...data, error: null })
      } catch (e) {
        if (alive) onChange({ error: e })
      }
    }, 100 + Math.random() * 300) // jitter so everyone doesn't hit the server at once
  }
  const es = new EventSource('/api/stream')
  es.onmessage = load // first message ("hello") triggers the initial load
  return () => { alive = false; clearTimeout(timer); es.close() }
}

export const yen = (n) => `¥${Number(n).toLocaleString('ja-JP')}`

export function fmtTime(ts) {
  if (!ts) return '-'
  const d = new Date(ts)
  const p = (n, l = 2) => String(n).padStart(l, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`
}
