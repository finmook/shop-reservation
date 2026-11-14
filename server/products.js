// Edit this list, then run `npm run seed`.
// `total` = how many pieces you can get for this product.
const NURSE = 'Chiikawa Clinic Take Care Mascot Key Ring'
const DOCTOR = 'Chiikawa Clinic Leave It To Us Mascot Key Ring'

const item = (id, name, price, total = 1, series = NURSE) => ({
  _id: id,
  name,
  fullName: `[Pre-order] Chiikawa ${series} (${name}) [Shipping mid-Dec 2026 / No Cancel / Separate Shipping Only]`,
  series,
  category: 'Chiikawa',
  image: `/products/${id}.jpg`,
  price, // yen, tax included
  total,
})

export const PRODUCTS = [
  item('chiikawa', 'Nurse Chiikawa', 1980),
  item('hachiware', 'Nurse Hachiware', 1980),
  item('usagi', 'Nurse Usagi', 1980),
  item('momonga', 'Nurse Momonga', 1980),
  item('kurimanju', 'Nurse Kurimanju', 1980),
  item('rakko', 'Nurse Rakko', 1980),
  item('shisa', 'Nurse Shisa', 1980),
  item('furuhonya', 'Nurse Furuhonya', 1980),
  item('anoko', 'Nurse Anoko', 1980),
  item('beetle', 'Nurse Beetle', 1650),
  item('doctor-rakko', 'Doctor Rakko', 1980, 1, DOCTOR),
  item('doctor-usagi', 'Doctor Usagi', 1980, 1, DOCTOR),
].map((p, i) => ({ ...p, sort: i }))
