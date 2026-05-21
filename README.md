# Shopee Mock API Server
### For Odoo Shopee Connector Demo

A Node.js/Express server that mimics Shopee's Open Platform API — including OAuth, products, orders, and logistics endpoints — so the **Odoo Shopee connector module works without real Shopee developer access**.

---

## What goes into Odoo

| Field | Value |
|-------|-------|
| **API Endpoint** | `https://YOUR_DEPLOYED_URL` (paste into Odoo) |
| **Partner ID** | `1` (or your custom value) |
| **Partner Key** | `1` (or your custom value) |
| **Endpoint type** | Shopee Testing Endpoint |

---

## Deploy in 3 minutes (Railway — recommended, free tier)

1. Push this folder to a GitHub repo (or drag-drop on Railway)
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select the repo — Railway auto-detects Node.js
4. Add environment variables (optional):
   - `PARTNER_ID=1`
   - `PARTNER_KEY=1`
   - `PORT=3000`
5. Click Deploy → copy the generated URL (e.g. `https://shopee-mock-api-production.up.railway.app`)
6. Paste that URL into Odoo's **API Endpoint** field

---

## Deploy on Render (free alternative)

1. New Web Service → connect GitHub repo
2. Build command: `npm install`
3. Start command: `node index.js`
4. Environment: `Node`
5. Add env vars: `PARTNER_ID=1`, `PARTNER_KEY=1`

---

## Run locally (for quick testing)

```bash
npm install
node index.js
# Server starts on http://localhost:3000
```

Use [ngrok](https://ngrok.com) to expose locally to Odoo:
```bash
ngrok http 3000
# Copy the https://xxxx.ngrok.io URL → paste into Odoo
```

---

## Implemented Shopee API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET`  | `/` | Health check |
| `GET`  | `/api/v2/auth/shop/get_auth_link` | Build OAuth URL for "Authorize Shop" button |
| `GET`  | `/api/v2/auth/callback` | OAuth redirect handler |
| `POST` | `/api/v2/auth/token/get` | Exchange auth code for access/refresh tokens |
| `POST` | `/api/v2/auth/access_token/get` | Refresh access token |
| `GET`  | `/api/v2/shop/get_shop_info` | Shop details |
| `GET`  | `/api/v2/product/get_item_list` | Paginated product list |
| `GET`  | `/api/v2/product/get_item_base_info` | Full product details by item_id |
| `GET`  | `/api/v2/order/get_order_list` | Order list with time/status filters |
| `GET`  | `/api/v2/order/get_order_detail` | Full order details with line items |
| `POST` | `/api/v2/logistics/init_shipment` | Mark order as shipped, return tracking |
| `POST` | `/webhook/push` | Receive webhook pushes from Odoo |

---

## Authorize Shop flow (Odoo → Mock)

When you click **Authorize Shop** in Odoo:
1. Odoo calls `GET /api/v2/auth/shop/get_auth_link?redirect_url=<odoo_callback>`
2. Mock returns an auth URL pointing back to itself
3. Mock immediately redirects to Odoo's callback with `?code=MOCK_AUTH_CODE_2026&shop_id=123456`
4. Odoo calls `POST /api/v2/auth/token/get` with the code
5. Mock returns fake `access_token` + `refresh_token`
6. Odoo is now "authorized" — the shop counter in the top-right shows 1

---

## Signature verification

By default the server runs in **demo mode** — it accepts all requests regardless of signature.

To enforce real HMAC-SHA256 checking (Shopee's actual algorithm):
```
STRICT_SIG=true node index.js
```

Shopee signature formula:
```
HMAC-SHA256(partner_key, partner_id + api_path + timestamp + access_token + shop_id)
```

---

## Seed data

**8 products** seeded in-memory:
- LAY123 — Lay's Classic 70g — ₱50
- CET456 — Cheetos Cheese 55g — ₱45
- PRT789 — Pringles Original 110g — ₱89
- GRC001 — Gardenia White Bread 400g — ₱65
- SFL002 — Skyflakes Crackers 100g — ₱35
- NES003 — Nescafe 3-in-1 Classic — ₱12
- CLR004 — Clara Ole Pasta Sauce 250g — ₱55
- SRF005 — Surf Laundry Powder 1kg — ₱120

**2 orders** seeded:
- SPX20260521001 — READY_TO_SHIP — Juan Dela Cruz
- SPX20260521002 — SHIPPED — Maria Santos

---

## Sample curl commands

```bash
BASE=https://YOUR_URL

# Health check
curl $BASE/

# Shop info
curl "$BASE/api/v2/shop/get_shop_info?partner_id=1&shop_id=123456&access_token=test&timestamp=9999999999&sign=demo"

# Product list
curl "$BASE/api/v2/product/get_item_list?partner_id=1&shop_id=123456&access_token=test&timestamp=9999999999&sign=demo&item_status=NORMAL&page_size=10"

# Order list
curl "$BASE/api/v2/order/get_order_list?partner_id=1&shop_id=123456&access_token=test&timestamp=9999999999&sign=demo&create_time_from=0&create_time_to=9999999999&page_size=20"

# Token exchange
curl -X POST $BASE/api/v2/auth/token/get \
  -H "Content-Type: application/json" \
  -d '{"code":"MOCK_AUTH_CODE_2026","shop_id":123456,"partner_id":1}'
```
