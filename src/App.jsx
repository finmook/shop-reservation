import { useEffect, useState } from 'react'
import { subscribeState, loadSession, saveSession } from './api.js'
import Login from './components/Login.jsx'
import Shop from './components/Shop.jsx'
import Dashboard from './components/Dashboard.jsx'
import RulesModal from './components/RulesModal.jsx'
import { DECOR } from './shop.js'

export default function App() {
  const [session, setSession] = useState(loadSession)
  const name = session?.username || ''
  const [tab, setTab] = useState('shop')
  const [state, setState] = useState({ products: [], mine: [], users: [], log: [], loading: true })

  const onLogin = (s) => { saveSession(s); setSession(s); setTab('shop') }
  const logout = () => { saveSession(null); setSession(null) }
  const acceptRules = () => onLogin({ ...session, rulesOk: true })

  useEffect(() => {
    if (!session) return
    return subscribeState(session, (d) => {
      if (d.error?.code === 'relogin') return logout()
      setState((s) => ({ ...s, ...d, loading: false }))
    })
  }, [session?.token])

  if (!session) return <Login onLogin={onLogin} />

  const myIds = new Set((state.mine ?? []).map((p) => p.productId))

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-emoji">{DECOR.brand}</span>
          <div>
            <div className="brand-title">ร้านรับหิ้วตุ๊กตา</div>
            <div className="brand-sub">ใครกดก่อน ได้ก่อน~ {DECOR.tagline}</div>
          </div>
        </div>
        <div className="user-pill">
          <span>🐦 @{name}{session.admin && ' (แอดมิน)'}</span>
          <button className="btn btn-ghost btn-sm" onClick={logout}>ออก</button>
        </div>
      </header>

      {session.admin && (
        <nav className="tabs">
          <button className={`tab ${tab === 'shop' ? 'active' : ''}`} onClick={() => setTab('shop')}>
            🛍️ สินค้า
          </button>
          <button className={`tab ${tab === 'dash' ? 'active' : ''}`} onClick={() => setTab('dash')}>
            🏆 Dashboard
          </button>
        </nav>
      )}

      <main>
        {state.error && <div className="error-box">เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กำลังลองใหม่… 🔌</div>}
        {session.admin && tab === 'dash'
          ? <Dashboard state={state} me={name} />
          : <Shop name={name} token={session.token} onRelogin={logout} products={state.products} myIds={myIds} mine={state.mine ?? []} loading={state.loading} />}
      </main>

      <footer className="footer">made with 💗 · เวลาทั้งหมดนับจากเซิร์ฟเวอร์</footer>

      {!session.rulesOk && <RulesModal onAccept={acceptRules} />}
    </div>
  )
}
