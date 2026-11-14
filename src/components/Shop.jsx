import { useEffect, useMemo, useState } from 'react'
import { reserve, baht } from '../api.js'
import ResultModal from './ResultModal.jsx'

const COOLDOWN_MS = 1500 // after each click, wait before the next one

export default function Shop({ name, token, onRelogin, products, myIds, loading }) {
  const categories = useMemo(
    () => [...new Set(['Chiikawa', ...products.map((p) => p.category)])],
    [products]
  )
  const [cat, setCat] = useState('Chiikawa')
  const [busyId, setBusyId] = useState(null)
  const [result, setResult] = useState(null)
  const [coolUntil, setCoolUntil] = useState(0)
  const [, tick] = useState(0)
  const cooling = coolUntil > Date.now()

  useEffect(() => {
    if (!cooling) return
    const t = setTimeout(() => tick((n) => n + 1), coolUntil - Date.now())
    return () => clearTimeout(t)
  }, [coolUntil, cooling])

  const list = products.filter((p) => p.category === cat)

  const onReserve = async (p) => {
    if (busyId || cooling || p.stock <= 0) return
    setBusyId(p._id)
    let wait = COOLDOWN_MS
    try {
      const r = await reserve(p._id, token)
      if (r.status === 'relogin') return onRelogin()
      if (r.status === 'ratelimited') wait = r.retryAfter * 1000
      setResult({ ...r, product: p })
    } catch (e) {
      setResult({ status: 'error', message: e.message, product: p })
    } finally {
      setBusyId(null)
      setCoolUntil(Date.now() + wait)
    }
  }

  return (
    <>
      <div className="chips">
        {categories.map((c) => (
          <button key={c} className={`chip ${c === cat ? 'active' : ''}`} onClick={() => setCat(c)}>
            {c === 'Chiikawa' ? '🐹 ' : '🎀 '}{c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty">กำลังโหลด... 🍡</div>
      ) : list.length === 0 ? (
        <div className="empty">ยังไม่มีสินค้าในหมวดนี้ 🥺</div>
      ) : (
        <div className="grid">
          {list.map((p) => {
            const mine = myIds.has(p._id)
            const soldOut = p.stock <= 0
            const busy = busyId === p._id
            return (
              <article key={p._id} className={`product ${soldOut && !mine ? 'taken' : ''} ${mine ? 'mine' : ''}`}>
                <div className="product-img">
                  <img src={p.image} alt={p.name} loading="lazy" />
                  {mine ? <div className="sold-badge mine">ของคุณ! 🎉</div>
                    : soldOut ? <div className="sold-badge">หมดแล้ว</div> : null}
                  <div className={`stock-pill ${soldOut ? 'zero' : ''}`}>เหลือ {p.stock}/{p.total}</div>
                </div>
                <div className="product-body">
                  <h3>{p.name}</h3>
                  <div className="series" title={p.fullName}>{p.series}</div>
                  <div className="price">{baht(p.price)}</div>
                  <div className="note">✈️ ส่งจากญี่ปุ่น กลาง ธ.ค. 2026 · ยกเลิกไม่ได้</div>
                  {mine ? (
                    <div className="owner">💝 จองแล้ว</div>
                  ) : (
                    <button
                      className={`btn btn-primary btn-round ${busy ? 'loading' : ''}`}
                      disabled={!!busyId || cooling || soldOut}
                      onClick={() => onReserve(p)}
                    >
                      {soldOut ? 'หมดแล้ว 🥲' : busy ? 'กำลังเช็ค...' : cooling ? 'รอแป๊บนะ…' : 'จองเลย! 💖'}
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {result && <ResultModal result={result} me={name} onClose={() => setResult(null)} />}
    </>
  )
}
