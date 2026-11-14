import { useEffect, useState } from 'react'
import { subscribeState, loadSession, saveSession } from './api.js'
import Login from './components/Login.jsx'
import Shop from './components/Shop.jsx'
import Dashboard from './components/Dashboard.jsx'

export default function App() {
  const [session, setSession] = useState(loadSession)
  const name = session?.username || ''
  const [tab, setTab] = useState('shop')
  const [state, setState] = useState({ products: [], users: [], log: [], loading: true })

  useEffect(() => {
    if (!name) return
    return subscribeState((d) => setState((s) => ({ ...s, ...d, loading: false })))
  }, [name])

  const onLogin = (s) => { saveSession(s); setSession(s) }
  const logout = () => { saveSession(null); setSession(null) }

  if (!name) return <Login onLogin={onLogin} />

  const me = state.users.find((u) => u.username.toLowerCase() === name.toLowerCase())
  const myIds = new Set((me?.products ?? []).map((p) => p.productId))

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-emoji">🧸</span>
          <div>
            <div className="brand-title">ร้านรับหิ้วตุ๊กตา</div>
            <div className="brand-sub">ใครกดก่อน ได้ก่อน~</div>
          </div>
        </div>
        <div className="user-pill">
          <span>🐦 @{name}</span>
          <button className="btn btn-ghost btn-sm" onClick={logout}>ออก</button>
        </div>
      </header>

      <nav className="tabs">
        <button className={`tab ${tab === 'shop' ? 'active' : ''}`} onClick={() => setTab('shop')}>
          🛍️ สินค้า
        </button>
        <button className={`tab ${tab === 'dash' ? 'active' : ''}`} onClick={() => setTab('dash')}>
          🏆 Dashboard
        </button>
      </nav>

      <main>
        {state.error && <div className="error-box">เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กำลังลองใหม่… 🔌</div>}
        {tab === 'shop'
          ? <Shop name={name} token={session.token} onRelogin={logout} products={state.products} myIds={myIds} loading={state.loading} />
          : <Dashboard state={state} me={name} />}
      </main>

      <footer className="footer">made with 💗 · เวลาทั้งหมดนับจากเซิร์ฟเวอร์</footer>
    </div>
  )
}
