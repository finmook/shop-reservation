import { useEffect, useState } from 'react'
import { ping } from '../api.js'
import { DECOR } from '../shop.js'

const POLL_MS = 3000
const GIVE_UP_MS = 3 * 60_000

// The free server sleeps when nobody uses it. Until it answers, show a friendly
// waiting page instead of a broken shop.
export default function WakeGate({ children }) {
  const [status, setStatus] = useState('checking') // checking | waking | ready | failed
  const [startedAt] = useState(Date.now)
  const [, tick] = useState(0)

  useEffect(() => {
    let alive = true
    let timer
    let first = true
    const check = async () => {
      const ok = await ping(first ? 2500 : 8000)
      first = false
      if (!alive) return
      if (ok) return setStatus('ready')
      if (Date.now() - startedAt > GIVE_UP_MS) return setStatus('failed')
      setStatus('waking')
      timer = setTimeout(check, POLL_MS)
    }
    check()
    return () => { alive = false; clearTimeout(timer) }
  }, [])

  useEffect(() => {
    if (status !== 'waking') return
    const t = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [status])

  if (status === 'ready') return children
  if (status === 'checking') return <div className="center-page"><div className="big-emoji bounce">{DECOR.hero}</div></div>

  const secs = Math.floor((Date.now() - startedAt) / 1000)
  const pct = Math.min(95, Math.round((secs / 60) * 100))

  return (
    <div className="center-page">
      <div className="card login-card wake">
        <div className="big-emoji bounce">{status === 'failed' ? '😵' : DECOR.hero}</div>
        <h1>ร้านรับหิ้วตุ๊กตา</h1>
        {status === 'failed' ? (
          <>
            <p>ร้านยังเปิดไม่ได้ ลองรีเฟรชหน้านี้อีกครั้งนะ</p>
            <button className="btn btn-primary btn-lg" onClick={() => location.reload()}>รีเฟรช</button>
          </>
        ) : (
          <>
            <p>
              <b>ร้านกำลังเปิดอยู่นะ~</b>
              <br />รอสักครู่ ประมาณ 1 นาที ไม่ต้องรีเฟรช
              <br />พอพร้อมแล้วหน้าร้านจะขึ้นมาเอง
            </p>
            <div className="wake-bar"><span style={{ width: `${pct}%` }} /></div>
            <div className="muted small">{secs} วินาที</div>
          </>
        )}
      </div>
    </div>
  )
}
