// Edit this list, then run `npm run seed`.
// price is in baht. total is how many pieces we have.
const NURSE = 'Chiikawa Clinic Take Care Mascot Key Ring'
const DOCTOR = 'Chiikawa Clinic Leave It To Us Mascot Key Ring'

const item = (id, name, price, total, series = NURSE) => ({
  _id: id,
  name,
  fullName: `[Pre-order] Chiikawa ${series} (${name})`,
  series,
  category: 'Chiikawa',
  image: `/products/${id}.jpg`,
  price,
  total,
})

export const PRODUCTS = [
  item('chiikawa', 'Nurse Chiikawa', 580, 2),
  item('hachiware', 'Nurse Hachiware', 580, 3),
  item('usagi', 'Nurse Usagi', 580, 1),
  item('momonga', 'Nurse Momonga', 580, 1),
  item('kurimanju', 'Nurse Kurimanju', 580, 3),
  item('shisa', 'Nurse Shisa', 580, 2),
  item('rakko', 'Nurse Rakko', 580, 3),
  item('furuhonya', 'Nurse Furuhonya', 580, 3),
  item('anoko', 'Nurse Anoko', 580, 2),
  item('beetle', 'Nurse Beetle', 550, 1),
  item('doctor-usagi', 'Doctor Usagi', 580, 1, DOCTOR),
  item('doctor-rakko', 'Doctor Rakko', 580, 1, DOCTOR),
].map((p, i) => ({ ...p, sort: i }))
