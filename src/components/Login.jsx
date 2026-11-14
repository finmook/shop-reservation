import { useEffect, useRef, useState } from 'react'
import { login } from '../api.js'

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY

/** Cloudflare Turnstile widget (only when VITE_TURNSTILE_SITE_KEY is set). */
function useTurnstile(ref, onToken) {
  useEffect(() => {
    if (!SITE_KEY || !ref.current) return
    let id
    const render = () => {
      id = window.turnstile.render(ref.current, {
        sitekey: SITE_KEY,
        theme: 'light',
        callback: onToken,
        'expired-callback': () => onToken(''),
        'error-callback': () => onToken(''),
      })
    }
    if (window.turnstile) render()
    else {
      let s = document.getElementById('cf-turnstile')
      if (!s) {
        s = document.createElement('script')
        s.id = 'cf-turnstile'
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
        s.async = true
        document.head.appendChild(s)
      }
      s.addEventListener('load', render, { once: true })
    }
    return () => { if (id !== undefined) window.turnstile?.remove(id) }
  }, [])
}

export default function Login({ onLogin }) {
  const [value, setValue] = useState('')
  const [honey, setHoney] = useState('')
  const [captcha, setCaptcha] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const box = useRef(null)
  useTurnstile(box, setCaptcha)

  const submit = async (e) => {
    e.preventDefault()
    const n = value.trim().replace(/^@+/, '')
    if (!/^[A-Za-z0-9_]{1,15}$/.test(n)) {
      setErr('ชื่อ Twitter ใช้ได้แค่ a-z, 0-9 และ _ ไม่เกิน 15 ตัวอักษร')
      return
    }
    if (SITE_KEY && !captcha) {
      setErr('รอให้ระบบยืนยันว่าไม่ใช่บอทก่อนนะ 🤖')
      return
    }
    setBusy(true)
    try {
      onLogin(await login(n, captcha, honey))
    } catch (e) {
      setErr(
        e.code === 'captcha' ? 'ยืนยันตัวตนไม่ผ่าน ลองใหม่อีกครั้งนะ'
          : e.code === 'too many requests' ? 'ลองเข้าบ่อยเกินไป รอสักครู่นะ ⏳'
          : 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้งนะ'
      )
      if (SITE_KEY) window.turnstile?.reset()
      setCaptcha('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="center-page">
      <form className="card login-card" onSubmit={submit}>
        <div className="big-emoji bounce">🧸</div>
        <h1>ร้านรับหิ้วตุ๊กตา</h1>
        <p className="muted">ใครกดก่อน ได้ก่อน~ ✨</p>

        <label htmlFor="tw" className="label">
          กรอกชื่อ Twitter ของคุณ
          <span className="label-en">Fill in your Twitter name</span>
        </label>
        <div className="input-wrap">
          <span className="at">@</span>
          <input
            id="tw"
            autoFocus
            autoComplete="off"
            placeholder="your_twitter"
            value={value}
            onChange={(e) => { setValue(e.target.value); setErr('') }}
          />
        </div>

        {/* honeypot — hidden from humans, bots tend to fill every field */}
        <input
          className="hp"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={honey}
          onChange={(e) => setHoney(e.target.value)}
        />

        {err && <div className="field-err">{err}</div>}

        <div className="warn">
          ⚠️ ชื่อต้อง<b>ตรงกับชื่อ Twitter (@username)</b> ของคุณเท่านั้น
          <br />ไม่งั้นทางร้านจะติดต่อกลับไม่ได้ และจะไม่ได้รับสินค้านะ
        </div>

        {SITE_KEY && <div className="captcha" ref={box} />}

        <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>
          {busy ? 'กำลังเข้าร้าน…' : 'เข้าร้านเลย 💕'}
        </button>
      </form>
    </div>
  )
}
