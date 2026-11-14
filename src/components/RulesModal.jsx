// Shown once after login. The customer has to accept before they can reserve.
export default function RulesModal({ onAccept }) {
  return (
    <div className="modal-backdrop">
      <div className="modal card tone-warn rules" role="alertdialog" aria-labelledby="rules-title">
        <div className="big-emoji pop">📢</div>
        <h2 id="rules-title">อ่านก่อนจองนะ</h2>
        <ul>
          <li><b>จองแล้วยกเลิกไม่ได้</b> กดจองเมื่อแน่ใจแล้วเท่านั้น</li>
          <li>สินค้าส่งจากญี่ปุ่น ประมาณ <b>กลางเดือน ธ.ค. 2026</b></li>
          <li>ทางร้านจะติดต่อกลับทาง <b>Twitter</b> ตามชื่อที่กรอก</li>
          <li>ถ้ามีคนกดพร้อมกันแล้วของไม่พอ รอบนั้นเป็นโมฆะ <b>ต้องกดใหม่</b></li>
          <li>จองได้คนละ 1 ชิ้นต่อแบบ</li>
        </ul>
        <button className="btn btn-primary btn-lg" onClick={onAccept} autoFocus>
          เข้าใจแล้ว เข้าร้านเลย
        </button>
      </div>
    </div>
  )
}
