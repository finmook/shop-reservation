import { useEffect } from 'react'

export default function ResultModal({ result, me, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const { status, product } = result
  let emoji, title, body, tone

  if (status === 'won') {
    emoji = '🎉'; tone = 'good'
    title = 'จองสำเร็จ!'
    body = <>คุณได้ <b>{product.name}</b> เป็น<b>คนที่ {result.order}</b>~<br />ทางร้านจะทักไปที่ Twitter <b>@{me}</b> นะคะ 💌<br /><span className="muted small">จองแล้วยกเลิกไม่ได้นะ</span></>
  } else if (status === 'tie') {
    const others = (result.tiedWith || []).filter((n) => n.toLowerCase() !== me.toLowerCase())
    emoji = '⚡'; tone = 'warn'
    title = 'มีคนกดพร้อมกัน!'
    body = (
      <>
        คุณกด <b>พร้อมกัน</b> กับ {others.map((n) => <b key={n}>@{n} </b>)}
        <br />รอบนี้เป็นโมฆะ <b>ทุกคนต้องกดใหม่อีกครั้ง</b> นะ! 🏃‍♀️💨
      </>
    )
  } else if (status === 'soldout') {
    emoji = '🥲'; tone = 'bad'
    title = 'หมดแล้ว...'
    body = <><b>{product.name}</b> ถูกจองครบแล้ว ไว้รอบหน้านะ 💕</>
  } else if (status === 'already') {
    emoji = '💝'; tone = 'good'
    title = 'คุณจองไว้แล้ว'
    body = <>คุณมี <b>{product.name}</b> อยู่แล้ว (จองได้คนละ 1 ชิ้น)</>
  } else if (status === 'ratelimited') {
    emoji = '🐢'; tone = 'warn'
    title = 'กดเร็วเกินไป!'
    body = <>ใจเย็น ๆ นะ รออีก <b>{result.retryAfter} วินาที</b> แล้วค่อยกดใหม่<br /><span className="muted">(กันบอทกดรัว ๆ)</span></>
  } else {
    emoji = '😵'; tone = 'bad'
    title = 'เกิดข้อผิดพลาด'
    body = <>ลองใหม่อีกครั้งนะ <span className="muted">({result.message})</span></>
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal card tone-${tone}`} role="alertdialog" onClick={(e) => e.stopPropagation()}>
        <div className="big-emoji pop">{emoji}</div>
        <h2>{title}</h2>
        <p>{body}</p>
        <button className="btn btn-primary btn-lg" onClick={onClose} autoFocus>
          {status === 'tie' ? 'โอเค ไปกดใหม่!' : 'ตกลง'}
        </button>
      </div>
    </div>
  )
}
