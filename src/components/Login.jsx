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
  const [password, setPassword] = useState('')
  const [needPass, setNeedPass] = useState(false)
  const [captcha, setCaptcha] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const box = useRef(null)
  useTurnstile(box, setCaptcha)

  const name = value.trim().replace(/^@+/, '')

  const submit = async (e) => {
    e.preventDefault()
    if (!/^[A-Za-z0-9_]{1,15}$/.test(name)) {
      setErr('ชื่อ Twitter ใช้ได้แค่ a-z, 0-9 และ _ ไม่เกิน 15 ตัวอักษร')
      return
    }
    if (needPass && !password) {
      setErr('กรุณาใส่รหัสผ่าน')
      return
    }
    if (SITE_KEY && !captcha) {
      setErr('รอให้ระบบยืนยันว่าไม่ใช่บอทก่อนนะ 🤖')
      return
    }
    setBusy(true)
    try {
      onLogin(await login(name, captcha, honey, needPass ? password : undefined))
    } catch (e) {
      // admin password errors happen before the captcha is checked, so the captcha is kept
      if (e.code === 'admin_password') { setNeedPass(true); setErr(''); return }
      if (e.code === 'wrong_password') { setErr('รหัสผ่านไม่ถูกต้อง'); return }
      setErr(
        e.code === 'captcha' ? 'ยืนยันตัวตนไม่ผ่าน ลองใหม่อีกครั้งนะ'
          : e.code === 'too many requests' ? 'ลองเข้าบ่อยเกินไป รอสักครู่นะ ⏳'
          : 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้งนะ'
      )
      if (SITE_KEY) window.turnstile?.reset()
      setCaptcha('')
      if (e.code === 'captcha') setNeedPass(false) // the captcha box is only visible on step 1
    } finally {
      setBusy(false)
    }
  }

  const back = () => { setNeedPass(false); setPassword(''); setErr('') }

  return (
    <div className="center-page">
      <form className="card login-card" onSubmit={submit}>
        {needPass ? (
          // step 2: only for admin names
          <>
            <div className="big-emoji pop">🔐</div>
            <h1>สวัสดีแอดมิน</h1>
            <p className="muted">@{name}</p>

            <label htmlFor="pw" className="label">
              รหัสผ่านแอดมิน
              <span className="label-en">Admin password</span>
            </label>
            <div className="input-wrap">
              <span className="at">🔒</span>
              <input
                id="pw"
                type="password"
                autoFocus
                autoComplete="current-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErr('') }}
              />
            </div>
            {err && <div className="field-err">{err}</div>}
          </>
        ) : (
          // step 1: everyone
          <>
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

            {/* honeypot: hidden from humans, bots tend to fill every field */}
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
              <br />จองได้แล้วต้องทัก DM ร้านด้วยบัญชีนี้ ถ้าชื่อไม่ตรงจะไม่ได้รับสินค้านะ
            </div>
          </>
        )}

        {/* kept mounted on both steps so the captcha token survives the switch */}
        {SITE_KEY && <div className="captcha" ref={box} style={needPass ? { display: 'none' } : undefined} />}

        <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>
          {busy ? 'กำลังเข้าร้าน…' : needPass ? 'เข้าสู่ระบบ' : 'เข้าร้านเลย 💕'}
        </button>
        {needPass && (
          <button type="button" className="btn btn-ghost btn-sm back-btn" onClick={back}>
            ← กลับ
          </button>
        )}
      </form>
    </div>
  )
}
