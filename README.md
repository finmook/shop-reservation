# 🧸 ร้านรับหิ้วตุ๊กตา — Product Reservation

"First click wins" reservation page. React (Vite) + Express + MongoDB Atlas.

## Setup

1. **Atlas**: create a free cluster → Database Access (add a user) → Network Access (allow your IP / server IP) → Connect → Drivers → copy the URI.
2. `cp .env.example .env` and paste the URI.
3. ```bash
   npm install
   npm run seed        # puts the 10 Nurse keyrings into Mongo
   ```
4. Dev (two terminals):
   ```bash
   npm run server      # API on :3001
   npm run dev         # website on :5173 (proxies /api)
   ```
5. Production: `npm run build && npm start` → everything on one port.
   Host on something that runs a long-lived Node process (Render, Railway, Fly, a VPS). **Not** Vercel/Netlify functions, and **one instance only** (the tie window lives in server memory).

## Products & stock

Edit `server/products.js` (`total` = pieces available, default 1), then `npm run seed`.
Images live in `public/products/`.

- `npm run seed` — add/update products, keep reservations
- `npm run seed -- --reset` — wipe all reservations and refill stock

## Data (MongoDB)

`reservation` (one document per user):
```js
{ username: "nif_tw", usernameLower: "nif_tw",
  products: [ { productId: "chiikawa", name: "Nurse Chiikawa", order: 1, clickedAt: ISODate(...) } ] }
```
`order` = this person was the Nth to get that product.
`products`: `{ _id, name, price, image, total, stock, reservedCount }`
`clicks`: log of wins/ties for the dashboard.

A product is only ever added to a user's list when they actually won it — sold-out or tied clicks are never saved there, and `stock` can't go below 0 (conditional `$inc` inside a transaction).

## "Same time" rule (`server/reserve.js`)

- Clicks on the same product within **500 ms** (`TIE_WINDOW_MS`) are one batch.
- Batch bigger than stock left → **tie**: nobody gets it, everyone sees "มีคนกดพร้อมกัน!" and must click again.
- Enough stock for everyone → all win, ordered by click time.
- `STRICT_TIE = true` → any 2+ people in the window tie, even if there's enough stock.
- One piece per person per product.

## Anti-bot (`server/guard.js`)

| Layer | What it does |
|---|---|
| Signed session token | Login returns an HMAC-signed token; `/api/reserve` takes the name **from the token**, not the body. Set `SESSION_SECRET`. |
| Rate limits | reserve: 6 / 10s per user, 30 / 10s per IP · login: 10 / 10 min per IP · state: 40 / 10s per IP |
| Strikes | Hitting a limit 3× in a minute → blocked for 2 minutes |
| Turnstile (optional) | Cloudflare bot check on login. Set `VITE_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET` |
| Honeypot | Hidden login field; bots that fill it are rejected |
| State cache | `/api/state` is cached and shared, so 100 viewers ≈ 1 Mongo read per update |
| SSE cap | Max 6 live connections per IP |
| Client cooldown | Button locks for 1.5s after each click |

Behind a proxy (Render/Railway/Cloudflare) set `TRUST_PROXY=1` so limits use the visitor's real IP.
