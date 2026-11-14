# Product Reservation

Reservation site for a small pre-order shop (ร้านรับหิ้วตุ๊กตา). Customers log in with their Twitter handle and click to reserve limited Chiikawa keyrings. Whoever clicks first gets it.

The tricky part was handling clicks that come in at almost the same time, so most of the interesting code is in `server/reserve.js`.

Built with React + Vite on the frontend, Express + MongoDB Atlas on the backend, and Server-Sent Events for live updates.

## How it works

Every click is timestamped on the server. The first click on a product starts a 500 ms window, and any other clicks on that product during the window go into the same batch. When the window closes:

- if there's no stock left, everyone gets "sold out"
- if more people clicked than there is stock, nobody gets it and everyone has to click again
- otherwise everyone in the batch gets one, ordered by click time

Batches for the same product are processed one at a time, and stock is decremented with a conditional update (`stock >= n`) inside a transaction, so it can't oversell.

Setting `STRICT_TIE = true` makes any two clicks in the window a tie, even if there's enough stock.

One item per person per product.

## Data

Three collections in the `shop` database:

```js
// reservation: one doc per customer
{ username: "alice", usernameLower: "alice",
  products: [{ productId: "usagi", name: "Nurse Usagi", order: 1, clickedAt: ISODate("...") }] }

// products
{ _id: "usagi", name: "Nurse Usagi", price: 580, total: 1, stock: 1, reservedCount: 0 }

// clicks: log of wins and ties for the dashboard
{ productId: "usagi", status: "tie", users: ["alice", "bob"], at: ISODate("...") }
```

`order` means this person was the nth to get that product. Products only get added to a customer's list if they actually won them.

## Bot protection

Since the free tiers have request limits, I added a few things in `server/guard.js`:

- Login returns an HMAC-signed token, and `/api/reserve` reads the username from the token instead of the request body.
- Rate limits: 6 reserve requests per 10s per user, 30 per 10s per IP, 10 logins per 10 min per IP. Hitting a limit 3 times within a minute blocks you for 2 minutes.
- Optional Cloudflare Turnstile on login.
- A hidden honeypot field on the login form.
- `/api/state` is cached, so lots of people watching the dashboard doesn't mean lots of DB reads.

## Admin dashboard

The dashboard (who got what, in what order, and the tie log) is only for the shop owner. Names listed in `ADMIN_USERNAMES` have to enter `ADMIN_PASSWORD` when logging in, since anyone could type any name otherwise. The admin flag is stored in the signed token, and the server only returns customer data from `/api/admin` to admin tokens. Customers get product stock from `/api/state` and their own reservations from `/api/me`.

Before entering the shop, customers have to accept the rules (reservations can't be cancelled, ships from Japan in mid-December).

## Why not Next.js

The 500 ms window keeps pending clicks in memory and SSE needs long-lived connections. On serverless (e.g. Vercel), requests can land on different instances and wouldn't see each other's clicks. So this runs as a single Node process that serves both the API and the built React app.

## Running it

```bash
cp .env.example .env    # MongoDB URI + SESSION_SECRET
npm install
npm run seed            # add products
npm run dev             # API on :3001, site on :5173
```

`npm run dev -- --host` exposes it on your local network so you can open it on your phone.

To edit products, change `server/products.js` and run `npm run seed` again. Changing `total` keeps existing reservations and recalculates stock. Products removed from the list are deleted. `npm run seed -- --reset` clears all reservations and refills stock.

## Testing simultaneous clicks

It's hard to test this with one mouse, so `scripts/test-tie.js` sends requests as fake users:

```bash
npm run test:tie -- usagi 2 0     # 2 people at the same time -> tie
npm run test:tie -- usagi 3 0     # 3 people -> tie
npm run test:tie -- usagi 2 300   # 300 ms apart -> still a tie
npm run test:tie -- usagi 2 700   # 700 ms apart -> first one wins
npm run seed -- --reset           # clean up afterwards
```

## Deploying

The API runs on Render and the site runs on Cloudflare Pages.

Render's free tier sleeps after 15 minutes without traffic and shows its own loading page while it starts. Putting the site on Pages means visitors always get our page first. It shows a "ร้านกำลังเปิด" screen and polls `/api/health` until the server is up, then loads the shop.

Render (API):
- build `npm install && npm run build`, start `npm start`
- env: `MONGODB_URI`, `DB_NAME`, `SESSION_SECRET`, `TRUST_PROXY=1`, `ALLOWED_ORIGINS=https://<site>.pages.dev`, `TURNSTILE_SECRET`, `ADMIN_USERNAMES`, `ADMIN_PASSWORD`
- only one instance, since the click window is in memory

Cloudflare Pages (site):
- build `npm run build`, output `dist`
- env: `VITE_API_URL=https://<api>.onrender.com`, `VITE_TURNSTILE_SITE_KEY`, `NODE_VERSION=22`

A free cron job (cron-job.org) hits `/api/health` every 10 minutes so the server mostly stays awake. One always-on service fits in Render's 750 free hours a month.

## Note

Product images and names belong to their owners (Chiikawa © Nagano). This is a personal project, not affiliated with the official store.
