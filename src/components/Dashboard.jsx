import { fmtTime } from '../api.js'

export default function Dashboard({ state, me }) {
  const { products, users, log } = state
  const isMe = (n) => n?.toLowerCase() === me.toLowerCase()

  // productId -> [{ username, order, clickedAt }] sorted by order
  const winners = {}
  for (const u of users) {
    for (const p of u.products) {
      ;(winners[p.productId] ??= []).push({ username: u.username, order: p.order, clickedAt: p.clickedAt })
    }
  }
  for (const k in winners) winners[k].sort((a, b) => a.order - b.order)

  const ties = log.filter((l) => l.status === 'tie')

  return (
    <div className="dash">
      <section className="card">
        <h2>🏆 ใครได้อะไรบ้าง</h2>
        <div className="dash-grid">
          {products.map((p) => {
            const list = winners[p._id] ?? []
            return (
              <div key={p._id} className="dash-item">
                <div className="dash-head">
                  <div className="thumb"><img src={p.image} alt="" /></div>
                  <div className="dash-title">
                    <h3>{p.name}</h3>
                    <div className="muted small">จองแล้ว {p.total - p.stock}/{p.total}</div>
                  </div>
                  <span className={`count ${p.stock === 0 ? 'zero' : ''}`}>
                    {p.stock === 0 ? 'หมด' : `เหลือ ${p.stock}`}
                  </span>
                </div>
                {list.length === 0 ? (
                  <div className="empty small">ยังไม่มีใครได้ ✨</div>
                ) : (
                  <ol className="timeline">
                    {list.map((w) => (
                      <li key={w.username} className={isMe(w.username) ? 'me' : ''}>
                        <span className="rank">{w.order}</span>
                        <span className="t-name">@{w.username}</span>
                        <span className="t-time">{fmtTime(w.clickedAt)}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section className="card">
        <h2>⚡ กดพร้อมกัน (ต้องกดใหม่)</h2>
        <p className="muted small">กดห่างกันไม่เกิน {state.tieWindowMs ?? 500} ms และของไม่พอทุกคน = รอบนั้นโมฆะ</p>
        {ties.length === 0 ? (
          <div className="empty small">ยังไม่มีใครกดชนกันเลย~</div>
        ) : (
          <ul className="timeline">
            {ties.map((t) => (
              <li key={t._id}>
                <span className="t-time">{fmtTime(t.at)}</span>
                <span className="t-prod">{t.productName}</span>
                <span className="t-users">
                  {t.users.map((u) => (
                    <span key={u} className={`badge tie ${isMe(u) ? 'me' : ''}`}>@{u}</span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>🧾 รายชื่อลูกค้า</h2>
        {users.length === 0 ? (
          <div className="empty small">ยังไม่มีใครจองได้</div>
        ) : (
          <ul className="winners">
            {users.map((u) => (
              <li key={u.username} className={isMe(u.username) ? 'me' : ''}>
                <span className="w-name">@{u.username}</span>
                <span className="w-prod">
                  {u.products.map((p) => `${p.name} (#${p.order})`).join(', ')}
                </span>
                <span className="count">{u.products.length} ชิ้น</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
