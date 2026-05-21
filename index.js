/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  SHOPEE MOCK API SERVER                                      ║
 * ║  Mimics Shopee Open Platform API for Odoo integration demo   ║
 * ║  Compatible with: Odoo Shopee connector (Partner ID/Key)     ║
 * ║                                                              ║
 * ║  Base URL this server exposes:                               ║
 * ║    https://YOUR_DOMAIN  ← paste this into Odoo              ║
 * ║                                                              ║
 * ║  Shopee API paths implemented:                               ║
 * ║    POST /api/v2/auth/token/get                               ║
 * ║    GET  /api/v2/shop/get_shop_info                           ║
 * ║    GET  /api/v2/product/get_item_list                        ║
 * ║    GET  /api/v2/product/get_item_base_info                   ║
 * ║    GET  /api/v2/order/get_order_list                         ║
 * ║    GET  /api/v2/order/get_order_detail                       ║
 * ║    POST /api/v2/logistics/init_shipment                      ║
 * ║    GET  /api/v2/shop/auth_partner  (OAuth redirect)          ║
 * ║    GET  /api/v2/auth/shop/get_auth_link  (OAuth link)        ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

const express  = require('express');
const crypto   = require('crypto');
const app      = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── CONFIG ────────────────────────────────────────────────────────────
const PARTNER_ID  = process.env.PARTNER_ID  || '1';
const PARTNER_KEY = process.env.PARTNER_KEY || '1';
const PORT        = process.env.PORT        || 3000;

// ── HMAC SIGNATURE HELPER ─────────────────────────────────────────────
function verifySignature(req) {
  if (process.env.STRICT_SIG !== 'true') return true;

  const { partner_id, timestamp, sign } = req.query;
  if (!partner_id || !timestamp || !sign) return false;
  if (String(partner_id) !== String(PARTNER_ID)) return false;

  const path      = req.path;
  const shopId    = req.query.shop_id    || '';
  const accessTok = req.query.access_token || '';
  const base      = `${PARTNER_ID}${path}${timestamp}${accessTok}${shopId}`;
  const expected  = crypto.createHmac('sha256', PARTNER_KEY).update(base).digest('hex');
  return sign === expected;
}

function requireAuth(req, res, next) {
  if (!verifySignature(req)) {
    return res.json({ error: 'auth_fail', message: 'Invalid signature or partner credentials.', request_id: rid() });
  }
  next();
}

function rid() {
  return 'mock_' + Math.random().toString(36).slice(2, 10).toUpperCase();
}

function ts() { return Math.floor(Date.now() / 1000); }

// ── IN-MEMORY DATA STORE ──────────────────────────────────────────────
const DB = {
  shop: {
    shop_id:       123456,
    shop_name:     'Demo Shopee Store PH',
    region:        'PH',
    status:        'NORMAL',
    is_cb:         false,
    auth_time:     ts(),
    expire_time:   ts() + 86400 * 30,
    description:   'Mock Shopee shop for Odoo demo integration.',
  },

  products: [
    { item_id: 10001, name: "Lay's Classic Salted Chips 60g", description: "Snacks / Chips — Lay's Classic Salted Chips 60g", category_id: 100, price: 62, stock: 100, sku: 'LAYS-001', barcode: '4800888101001', status: 'NORMAL' },
    { item_id: 10002, name: "Lay's Cheese & Onion Chips 60g", description: "Snacks / Chips — Lay's Cheese & Onion Chips 60g", category_id: 100, price: 62, stock: 100, sku: 'LAYS-002', barcode: '4800888101002', status: 'NORMAL' },
    { item_id: 10003, name: "Lay's BBQ Chips 60g", description: "Snacks / Chips — Lay's BBQ Chips 60g", category_id: 100, price: 62, stock: 100, sku: 'LAYS-003', barcode: '4800888101003', status: 'NORMAL' },
    { item_id: 10004, name: "Lay's Sour Cream & Onion 85g", description: "Snacks / Chips — Lay's Sour Cream & Onion 85g", category_id: 100, price: 89, stock: 100, sku: 'LAYS-004', barcode: '4800888101004', status: 'NORMAL' },
    { item_id: 10005, name: "Cheetos Crunchy 80g", description: "Snacks / Chips — Cheetos Crunchy 80g", category_id: 100, price: 62, stock: 100, sku: 'CHTO-001', barcode: '4800888102001', status: 'NORMAL' },
    { item_id: 10006, name: "Cheetos Puffs 80g", description: "Snacks / Chips — Cheetos Puffs 80g", category_id: 100, price: 62, stock: 100, sku: 'CHTO-002', barcode: '4800888102002', status: 'NORMAL' },
    { item_id: 10007, name: "Cheetos Flamin' Hot 80g", description: "Snacks / Chips — Cheetos Flamin' Hot 80g", category_id: 100, price: 62, stock: 100, sku: 'CHTO-003', barcode: '4800888102003', status: 'NORMAL' },
    { item_id: 10008, name: "Doritos Nacho Cheese 100g", description: "Snacks / Chips — Doritos Nacho Cheese 100g", category_id: 100, price: 75, stock: 100, sku: 'DORI-001', barcode: '4800888103001', status: 'NORMAL' },
    { item_id: 10009, name: "Doritos Cool Ranch 100g", description: "Snacks / Chips — Doritos Cool Ranch 100g", category_id: 100, price: 75, stock: 100, sku: 'DORI-002', barcode: '4800888103002', status: 'NORMAL' },
    { item_id: 10010, name: "Doritos Spicy Sweet Chili 100g", description: "Snacks / Chips — Doritos Spicy Sweet Chili 100g", category_id: 100, price: 75, stock: 100, sku: 'DORI-003', barcode: '4800888103003', status: 'NORMAL' },
    { item_id: 10011, name: "Quaker Oats 800g", description: "Breakfast / Cereals — Quaker Oats 800g", category_id: 200, price: 149, stock: 100, sku: 'QKRO-001', barcode: '4800888104001', status: 'NORMAL' },
    { item_id: 10012, name: "Quaker Instant Oatmeal Sachet 40g", description: "Breakfast / Cereals — Quaker Instant Oatmeal Sachet 40g", category_id: 200, price: 35, stock: 100, sku: 'QKRO-002', barcode: '4800888104002', status: 'NORMAL' },
    { item_id: 10013, name: "Quaker Oats Granola Honey 400g", description: "Breakfast / Cereals — Quaker Oats Granola Honey 400g", category_id: 200, price: 189, stock: 100, sku: 'QKRO-003', barcode: '4800888104003', status: 'NORMAL' },
    { item_id: 10014, name: "Quaker Chewy Granola Bar Choc Chip 42g", description: "Snacks / Bars — Quaker Chewy Granola Bar Choc Chip 42g", category_id: 101, price: 45, stock: 100, sku: 'QKRO-004', barcode: '4800888104004', status: 'NORMAL' },
    { item_id: 10015, name: "M&M's Milk Chocolate 100g", description: "Confectionery / Chocolate — M&M's Milk Chocolate 100g", category_id: 300, price: 129, stock: 100, sku: 'MNMS-001', barcode: '4800888105001', status: 'NORMAL' },
    { item_id: 10016, name: "M&M's Peanut 100g", description: "Confectionery / Chocolate — M&M's Peanut 100g", category_id: 300, price: 129, stock: 100, sku: 'MNMS-002', barcode: '4800888105002', status: 'NORMAL' },
    { item_id: 10017, name: "M&M's Crispy 100g", description: "Confectionery / Chocolate — M&M's Crispy 100g", category_id: 300, price: 129, stock: 100, sku: 'MNMS-003', barcode: '4800888105003', status: 'NORMAL' },
    { item_id: 10018, name: "Snickers Bar 52g", description: "Confectionery / Chocolate — Snickers Bar 52g", category_id: 300, price: 45, stock: 100, sku: 'SNIC-001', barcode: '4800888106001', status: 'NORMAL' },
    { item_id: 10019, name: "Snickers Peanut Butter Bar 52g", description: "Confectionery / Chocolate — Snickers Peanut Butter Bar 52g", category_id: 300, price: 49, stock: 100, sku: 'SNIC-002', barcode: '4800888106002', status: 'NORMAL' },
    { item_id: 10020, name: "Snickers Miniatures 240g", description: "Confectionery / Chocolate — Snickers Miniatures 240g", category_id: 300, price: 249, stock: 100, sku: 'SNIC-003', barcode: '4800888106003', status: 'NORMAL' },
    { item_id: 10021, name: "Nutella Hazelnut Spread 350g", description: "Spreads / Condiments — Nutella Hazelnut Spread 350g", category_id: 400, price: 259, stock: 100, sku: 'NUTE-001', barcode: '4800888107001', status: 'NORMAL' },
    { item_id: 10022, name: "Nutella Hazelnut Spread 750g", description: "Spreads / Condiments — Nutella Hazelnut Spread 750g", category_id: 400, price: 499, stock: 100, sku: 'NUTE-002', barcode: '4800888107002', status: 'NORMAL' },
    { item_id: 10023, name: "Nutella & Go Snack Pack 48g", description: "Snacks / Bars — Nutella & Go Snack Pack 48g", category_id: 101, price: 65, stock: 100, sku: 'NUTE-003', barcode: '4800888107003', status: 'NORMAL' },
    { item_id: 10024, name: "Tic Tac Orange 16g", description: "Confectionery / Candy — Tic Tac Orange 16g", category_id: 301, price: 25, stock: 100, sku: 'TICT-001', barcode: '4800888108001', status: 'NORMAL' },
    { item_id: 10025, name: "Tic Tac Mint 16g", description: "Confectionery / Candy — Tic Tac Mint 16g", category_id: 301, price: 25, stock: 100, sku: 'TICT-002', barcode: '4800888108002', status: 'NORMAL' },
    { item_id: 10026, name: "Tic Tac Strawberry 16g", description: "Confectionery / Candy — Tic Tac Strawberry 16g", category_id: 301, price: 25, stock: 100, sku: 'TICT-003', barcode: '4800888108003', status: 'NORMAL' },
    { item_id: 10027, name: "Tic Tac Lime & Orange Mix 16g", description: "Confectionery / Candy — Tic Tac Lime & Orange Mix 16g", category_id: 301, price: 25, stock: 100, sku: 'TICT-004', barcode: '4800888108004', status: 'NORMAL' },
    { item_id: 10028, name: "Loacker Classic Vanilla 175g", description: "Snacks / Biscuits — Loacker Classic Vanilla 175g", category_id: 102, price: 135, stock: 100, sku: 'LOAC-001', barcode: '4800888109001', status: 'NORMAL' },
    { item_id: 10029, name: "Loacker Chocolate Wafer 175g", description: "Snacks / Biscuits — Loacker Chocolate Wafer 175g", category_id: 102, price: 135, stock: 100, sku: 'LOAC-002', barcode: '4800888109002', status: 'NORMAL' },
    { item_id: 10030, name: "Loacker Hazelnut Wafer 175g", description: "Snacks / Biscuits — Loacker Hazelnut Wafer 175g", category_id: 102, price: 135, stock: 100, sku: 'LOAC-003', barcode: '4800888109003', status: 'NORMAL' },
    { item_id: 10031, name: "Pedigree Adult Dry Dog Food 3kg", description: "Pet Food / Dog — Pedigree Adult Dry Dog Food 3kg", category_id: 700, price: 399, stock: 100, sku: 'PEDI-001', barcode: '4800888110001', status: 'NORMAL' },
    { item_id: 10032, name: "Pedigree Puppy Dry Dog Food 1.5kg", description: "Pet Food / Dog — Pedigree Puppy Dry Dog Food 1.5kg", category_id: 700, price: 249, stock: 100, sku: 'PEDI-002', barcode: '4800888110002', status: 'NORMAL' },
    { item_id: 10033, name: "Pedigree Wet Dog Food Beef 130g", description: "Pet Food / Dog — Pedigree Wet Dog Food Beef 130g", category_id: 700, price: 45, stock: 100, sku: 'PEDI-003', barcode: '4800888110003', status: 'NORMAL' },
    { item_id: 10034, name: "Pedigree DentaStix Daily Oral Care 7s", description: "Pet Food / Dog — Pedigree DentaStix Daily Oral Care 7s", category_id: 700, price: 119, stock: 100, sku: 'PEDI-004', barcode: '4800888110004', status: 'NORMAL' },
    { item_id: 10035, name: "Ferrero Rocher 3pcs Box", description: "Confectionery / Chocolate — Ferrero Rocher 3pcs Box", category_id: 300, price: 89, stock: 100, sku: 'FERR-001', barcode: '4800888111001', status: 'NORMAL' },
    { item_id: 10036, name: "Ferrero Rocher 16pcs Box 200g", description: "Confectionery / Chocolate — Ferrero Rocher 16pcs Box 200g", category_id: 300, price: 419, stock: 100, sku: 'FERR-002', barcode: '4800888111002', status: 'NORMAL' },
    { item_id: 10037, name: "Ferrero Rocher 24pcs Box 300g", description: "Confectionery / Chocolate — Ferrero Rocher 24pcs Box 300g", category_id: 300, price: 599, stock: 100, sku: 'FERR-003', barcode: '4800888111003', status: 'NORMAL' },
    { item_id: 10038, name: "Swiss Miss Hot Cocoa Mix 28g Sachet", description: "Beverages / Hot Drinks — Swiss Miss Hot Cocoa Mix 28g Sachet", category_id: 500, price: 29, stock: 100, sku: 'SWMS-001', barcode: '4800888112001', status: 'NORMAL' },
    { item_id: 10039, name: "Swiss Miss Milk Chocolate Mix 10s", description: "Beverages / Hot Drinks — Swiss Miss Milk Chocolate Mix 10s", category_id: 500, price: 259, stock: 100, sku: 'SWMS-002', barcode: '4800888112002', status: 'NORMAL' },
    { item_id: 10040, name: "Swiss Miss Dark Chocolate Mix 10s", description: "Beverages / Hot Drinks — Swiss Miss Dark Chocolate Mix 10s", category_id: 500, price: 275, stock: 100, sku: 'SWMS-003', barcode: '4800888112003', status: 'NORMAL' },
    { item_id: 10041, name: "Dole Pineapple Juice 240ml Can", description: "Beverages / Juice — Dole Pineapple Juice 240ml Can", category_id: 501, price: 35, stock: 100, sku: 'DOLE-001', barcode: '4800888113001', status: 'NORMAL' },
    { item_id: 10042, name: "Dole Pineapple Chunks in Juice 227g", description: "Food / Canned Fruit — Dole Pineapple Chunks in Juice 227g", category_id: 600, price: 69, stock: 100, sku: 'DOLE-002', barcode: '4800888113002', status: 'NORMAL' },
    { item_id: 10043, name: "Dole Tropical Fruit Salad 227g", description: "Food / Canned Fruit — Dole Tropical Fruit Salad 227g", category_id: 600, price: 79, stock: 100, sku: 'DOLE-003', barcode: '4800888113003', status: 'NORMAL' },
    { item_id: 10044, name: "Dole Crushed Pineapple 227g", description: "Food / Canned Fruit — Dole Crushed Pineapple 227g", category_id: 600, price: 65, stock: 100, sku: 'DOLE-004', barcode: '4800888113004', status: 'NORMAL' },
    { item_id: 10045, name: "Reynolds Wrap Aluminum Foil 37.2 sqft", description: "Household / Kitchen — Reynolds Wrap Aluminum Foil 37.2 sqft", category_id: 800, price: 149, stock: 100, sku: 'REYN-001', barcode: '4800888114001', status: 'NORMAL' },
    { item_id: 10046, name: "Reynolds Wrap Heavy Duty Foil 50 sqft", description: "Household / Kitchen — Reynolds Wrap Heavy Duty Foil 50 sqft", category_id: 800, price: 199, stock: 100, sku: 'REYN-002', barcode: '4800888114002', status: 'NORMAL' },
    { item_id: 10047, name: "Reynolds Kitchens Parchment Paper 30sqft", description: "Household / Kitchen — Reynolds Kitchens Parchment Paper 30sqft", category_id: 800, price: 129, stock: 100, sku: 'REYN-003', barcode: '4800888114003', status: 'NORMAL' },
    { item_id: 10048, name: "Reynolds Oven Bags Turkey Size 2s", description: "Household / Kitchen — Reynolds Oven Bags Turkey Size 2s", category_id: 800, price: 119, stock: 100, sku: 'REYN-004', barcode: '4800888114004', status: 'NORMAL' },
    { item_id: 10049, name: "Reynolds Wrap Non-Stick Foil 35 sqft", description: "Household / Kitchen — Reynolds Wrap Non-Stick Foil 35 sqft", category_id: 800, price: 169, stock: 100, sku: 'REYN-005', barcode: '4800888114005', status: 'NORMAL' },
    { item_id: 10050, name: "Reynolds Cut-Rite Wax Paper 75 sqft", description: "Household / Kitchen — Reynolds Cut-Rite Wax Paper 75 sqft", category_id: 800, price: 109, stock: 100, sku: 'REYN-006', barcode: '4800888114006', status: 'NORMAL' }
  ],

  orders: [
    {
      order_sn:       'SPX20260521001',
      order_status:   'READY_TO_SHIP',
      create_time:    ts() - 3600,
      update_time:    ts() - 1800,
      buyer_username: 'juan_delacruz',
      recipient_name: 'Juan Dela Cruz',
      actual_price:   515,
      currency:       'PHP',
      tracking_no:    '',
      item_list: [
        { item_id: 10001, item_name: "Lay's Classic Salted Chips 60g", model_sku: 'LAYS-001', model_quantity_purchased: 3, model_discounted_price: 62 },
        { item_id: 10008, item_name: "Doritos Nacho Cheese 100g",      model_sku: 'DORI-001', model_quantity_purchased: 2, model_discounted_price: 75 },
        { item_id: 10015, item_name: "M&M's Milk Chocolate 100g",      model_sku: 'MNMS-001', model_quantity_purchased: 1, model_discounted_price: 129 },
      ],
    },
    {
      order_sn:       'SPX20260521002',
      order_status:   'SHIPPED',
      create_time:    ts() - 86400,
      update_time:    ts() - 43200,
      buyer_username: 'maria_santos',
      recipient_name: 'Maria Santos',
      actual_price:   874,
      currency:       'PHP',
      tracking_no:    'PHSPX1234567890',
      item_list: [
        { item_id: 10021, item_name: "Nutella Hazelnut Spread 350g", model_sku: 'NUTE-001', model_quantity_purchased: 2, model_discounted_price: 259 },
        { item_id: 10035, item_name: "Ferrero Rocher 3pcs Box",      model_sku: 'FERR-001', model_quantity_purchased: 4, model_discounted_price: 89 },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────
//  ROOT — demo dashboard UI
// ─────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Shopee Mock API — Demo Dashboard</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;color:#1a1a1a;font-size:14px}
.header{background:#EE4D2D;padding:14px 24px;display:flex;align-items:center;gap:12px}
.header-logo{width:34px;height:34px;background:white;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:700;color:#EE4D2D;font-size:15px;flex-shrink:0}
.header h1{color:white;font-size:15px;font-weight:500}
.badge{margin-left:auto;background:rgba(255,255,255,0.2);color:white;font-size:11px;padding:3px 10px;border-radius:20px;display:flex;align-items:center;gap:5px;white-space:nowrap}
.dot{width:7px;height:7px;border-radius:50%;background:#4ade80;display:inline-block;animation:pulse 1.5s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.container{padding:18px;max-width:960px;margin:0 auto}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
@media(max-width:600px){.cards{grid-template-columns:repeat(2,1fr)}}
.card{background:white;border:1px solid #e5e5e5;border-radius:10px;padding:12px 14px}
.card-label{font-size:11px;color:#888;margin-bottom:4px}
.card-value{font-size:22px;font-weight:600}
.card-value.orange{color:#EE4D2D}
.card-value.green{color:#16a34a}
.section{background:white;border:1px solid #e5e5e5;border-radius:10px;margin-bottom:14px;overflow:hidden}
.section-header{padding:12px 16px;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;justify-content:space-between}
.section-title{font-size:13px;font-weight:600}
.btn{padding:6px 14px;border-radius:7px;font-size:12px;cursor:pointer;border:none;font-weight:600;transition:all .15s}
.btn-primary{background:#EE4D2D;color:white}
.btn-primary:hover:not(:disabled){background:#d94426}
.btn-primary:disabled{background:#ccc;cursor:not-allowed}
.btn-outline{background:transparent;border:1px solid #ddd;color:#333}
.btn-outline:hover:not(:disabled){background:#f5f5f5}
.btn-outline:disabled{opacity:.5;cursor:not-allowed}
table{width:100%;border-collapse:collapse;font-size:12px}
th{text-align:left;padding:8px 16px;font-size:11px;color:#888;font-weight:500;border-bottom:1px solid #f0f0f0;background:#fafafa}
td{padding:9px 16px;border-bottom:1px solid #f5f5f5}
tr:last-child td{border-bottom:none}
tr:hover td{background:#fafafa}
.status{display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600}
.status.ready{background:#FFF3E0;color:#E65100}
.status.shipped{background:#E8F5E9;color:#2E7D32}
.status.normal{background:#E3F2FD;color:#1565C0}
.progress-bar{height:5px;background:#f0f0f0;border-radius:3px;overflow:hidden;margin-top:6px}
.progress-fill{height:100%;background:#EE4D2D;border-radius:3px;transition:width .4s ease}
.sync-log{font-size:11px;color:#555;font-family:'SF Mono',monospace;padding:10px 16px;max-height:110px;overflow-y:auto;background:#fafafa;border-top:1px solid #f0f0f0}
.log-line{padding:2px 0;display:flex;gap:8px}
.log-time{color:#bbb;min-width:58px}
.log-ok{color:#16a34a}
.log-info{color:#2563eb}
.banner{background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:12px 16px;display:flex;align-items:center;gap:8px;margin-bottom:14px}
.banner i{color:#16a34a;font-size:18px}
.banner span{font-size:13px;color:#15803d;font-weight:500}
.shop-info{display:flex;align-items:center;gap:12px;padding:12px 16px}
.shop-avatar{width:38px;height:38px;background:#FFF3E0;border-radius:9px;display:flex;align-items:center;justify-content:center;color:#EE4D2D;font-size:18px;flex-shrink:0}
.shop-name{font-size:13px;font-weight:600}
.shop-meta{font-size:11px;color:#888;margin-top:2px}
.auth-body{padding:0 16px 14px}
.auth-label{font-size:11px;color:#888;margin-bottom:5px}
.empty{color:#bbb;text-align:center;padding:24px;font-size:12px}
.mono{font-family:'SF Mono',monospace;font-size:11px}
</style>
</head>
<body>
<div class="header">
  <div class="header-logo">S</div>
  <h1>Shopee Mock API &mdash; Demo Dashboard</h1>
  <span class="badge"><span class="dot"></span>Live &nbsp;&bull;&nbsp; v2.0.0 &nbsp;&bull;&nbsp; Partner ID: ${PARTNER_ID}</span>
</div>

<div class="container">

  <div class="banner" id="banner" style="display:none">
    <i class="ti ti-circle-check"></i>
    <span>Shop authorized and connected &mdash; Demo Shopee Store PH (ID: 123456, Region: PH)</span>
  </div>

  <div class="cards">
    <div class="card"><div class="card-label">Shop status</div><div class="card-value orange" id="shop-status">Standby</div></div>
    <div class="card"><div class="card-label">Orders synced</div><div class="card-value" id="orders-count">0</div></div>
    <div class="card"><div class="card-label">Products synced</div><div class="card-value" id="products-count">0</div></div>
    <div class="card"><div class="card-label">API calls made</div><div class="card-value" id="api-calls">0</div></div>
  </div>

  <div class="section">
    <div class="section-header">
      <span class="section-title">Shop authorization</span>
      <button class="btn btn-primary" id="auth-btn" onclick="startAuth()">Authorize shop</button>
    </div>
    <div class="shop-info">
      <div class="shop-avatar"><i class="ti ti-building-store"></i></div>
      <div>
        <div class="shop-name">Demo Shopee Store PH</div>
        <div class="shop-meta">Region: PH &nbsp;&bull;&nbsp; Shop ID: 123456 &nbsp;&bull;&nbsp; Endpoint: ${req.protocol}://${req.get('host')}</div>
      </div>
    </div>
    <div class="auth-body">
      <div class="auth-label" id="auth-label">Ready to authorize</div>
      <div class="progress-bar"><div class="progress-fill" id="auth-progress" style="width:0%"></div></div>
    </div>
    <div class="sync-log" id="auth-log"></div>
  </div>

  <div class="section">
    <div class="section-header">
      <span class="section-title">Orders</span>
      <button class="btn btn-outline" id="sync-btn" onclick="syncOrders()" disabled>Sync orders</button>
    </div>
    <table>
      <thead><tr><th>Order no.</th><th>Customer</th><th>Items</th><th>Amount</th><th>Status</th></tr></thead>
      <tbody id="orders-table"><tr><td colspan="5" class="empty">Authorize shop to load orders</td></tr></tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-header">
      <span class="section-title">Products</span>
      <span style="font-size:11px;color:#888" id="products-label">&mdash;</span>
    </div>
    <table>
      <thead><tr><th>SKU</th><th>Product name</th><th>Price</th><th>Stock</th><th>Status</th><th>Action</th></tr></thead>
      <tbody id="products-table"><tr><td colspan="5" class="empty">Authorize shop to load products</td></tr></tbody>
    </table>
  </div>

</div>

<script>
let apiCalls=0,authorized=false;
function nowTime(){const d=new Date();return[d.getHours(),d.getMinutes(),d.getSeconds()].map(n=>String(n).padStart(2,'0')).join(':')}
function addLog(msg,type){const log=document.getElementById('auth-log');const line=document.createElement('div');line.className='log-line';line.innerHTML='<span class="log-time">'+nowTime()+'</span><span class="log-'+type+'">'+msg+'</span>';log.appendChild(line);log.scrollTop=log.scrollHeight}
function setProgress(pct,label){document.getElementById('auth-progress').style.width=pct+'%';document.getElementById('auth-label').textContent=label}
function incApi(){document.getElementById('api-calls').textContent=++apiCalls}

function startAuth(){
  const btn=document.getElementById('auth-btn');
  btn.disabled=true;btn.textContent='Authorizing...';
  addLog('Requesting authorization link from mock server...','info');
  setProgress(15,'Requesting authorization link...');
  setTimeout(()=>{incApi();addLog('GET /api/v2/auth/shop/get_auth_link \u2192 200 OK','ok');setProgress(35,'OAuth redirect received...');addLog('Auth code received: MOCK_AUTH_CODE_2026','ok')},800);
  setTimeout(()=>{incApi();addLog('POST /api/v2/auth/token/get \u2192 200 OK','ok');setProgress(65,'Exchanging token...');addLog('Access token granted \u2014 expires in 30 days','ok')},1800);
  setTimeout(()=>{incApi();addLog('GET /api/v2/shop/get_shop_info \u2192 200 OK','ok');setProgress(90,'Loading shop info...');addLog('Shop: Demo Shopee Store PH (ID: 123456, Region: PH)','ok')},2600);
  setTimeout(()=>{
    setProgress(100,'Authorization complete');
    addLog('Shop authorized successfully','ok');
    authorized=true;
    document.getElementById('shop-status').textContent='Connected';
    document.getElementById('shop-status').style.color='#16a34a';
    document.getElementById('banner').style.display='flex';
    document.getElementById('sync-btn').disabled=false;
    btn.textContent='Authorized';btn.style.background='#16a34a';
    loadProducts();syncOrders();
  },3400);
}

function syncOrders(){
  if(!authorized)return;incApi();
  const orders=[
    {sn:'SPX20260521001',customer:'Juan Dela Cruz',items:"Lay\\'s Classic x3, Doritos x2, M&M\\'s x1",amount:'\u20B1515',status:'READY_TO_SHIP'},
    {sn:'SPX20260521002',customer:'Maria Santos',items:'Nutella 350g x2, Ferrero Rocher x4',amount:'\u20B1874',status:'SHIPPED'},
    {sn:'SPX20260521003',customer:'Jose Reyes',items:'Quaker Oats x1, Cheetos x2, Tic Tac x3',amount:'\u20B1337',status:'READY_TO_SHIP'},
    {sn:'SPX20260521004',customer:'Ana Mendoza',items:'Ferrero Rocher 16pcs x1',amount:'\u20B1419',status:'SHIPPED'},
  ];
  const tbody=document.getElementById('orders-table');tbody.innerHTML='';
  let i=0;
  const iv=setInterval(()=>{
    if(i>=orders.length){clearInterval(iv);return}
    const o=orders[i],cls=o.status==='SHIPPED'?'shipped':'ready';
    tbody.innerHTML+='<tr><td class="mono">'+o.sn+'</td><td>'+o.customer+'</td><td style="color:#888">'+o.items+'</td><td style="font-weight:600">'+o.amount+'</td><td><span class="status '+cls+'">'+o.status+'</span></td></tr>';
    document.getElementById('orders-count').textContent=++i;
  },300);
}

function loadProducts(){
  incApi();
  fetch('/api/v2/product/get_item_list?partner_id=1&shop_id=123456&access_token=demo&timestamp=9999999999&sign=demo&item_status=NORMAL&page_size=10')
    .then(r=>r.json())
    .then(data=>{
      const ids=data.response.item.map(i=>i.item_id).join(',');
      return fetch('/api/v2/product/get_item_base_info?partner_id=1&shop_id=123456&access_token=demo&timestamp=9999999999&sign=demo&item_id_list='+ids);
    })
    .then(r=>r.json())
    .then(data=>{
      const products=data.response.item_list;
      const tbody=document.getElementById('products-table');tbody.innerHTML='';
      let i=0;
      const iv=setInterval(()=>{
        if(i>=products.length){clearInterval(iv);document.getElementById('products-label').textContent=products.length+' products synced';return}
        const p=products[i];
        const stock=p.stock_info_v2.summary_info.total_available_stock;
        const price=p.price_info[0].current_price;
        const stockColor=stock<=10?'color:#E65100;font-weight:600':stock<=30?'color:#f59e0b;font-weight:600':'color:#16a34a;font-weight:600';
        tbody.innerHTML+='<tr id="row-'+p.item_id+'"><td class="mono">'+p.sku+'</td><td>'+p.item_name+'</td><td style="font-weight:600">\u20B1'+price+'</td><td style="'+stockColor+'" id="stock-'+p.item_id+'">'+stock+'</td><td><span class="status normal">NORMAL</span></td><td><button class="btn btn-outline" style="padding:3px 10px;font-size:11px" onclick="deductStock('+p.item_id+',\''+p.sku+'\')">-1 sold</button></td></tr>';
        document.getElementById('products-count').textContent=++i;
      },180);
    });
}

function deductStock(itemId, sku){
  const el=document.getElementById('stock-'+itemId);
  if(!el)return;
  const current=parseInt(el.textContent)||0;
  const newStock=Math.max(0,current-1);
  fetch('/api/v2/product/update_stock?partner_id=1&shop_id=123456&access_token=demo&timestamp=9999999999&sign=demo',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({item_id:itemId,stock_list:[{model_id:0,normal_stock:newStock}]})
  }).then(()=>{
    el.textContent=newStock;
    el.style.color=newStock<=10?'#E65100':newStock<=30?'#f59e0b':'#16a34a';
    addLog('POST /api/v2/product/update_stock \u2192 '+sku+' stock: '+current+' \u2192 '+newStock+' (synced to Odoo)','ok');
    incApi();
    if(newStock===0){
      el.textContent='OUT OF STOCK';
      el.style.color='#dc2626';
      addLog('ALERT: '+sku+' is now out of stock \u2014 Shopee listing auto-paused','info');
    }
  });
}
</script>
</body>
</html>`);
});

// ─────────────────────────────────────────────────────────────────────
//  AUTH — auth_partner
//
//  Odoo calls this to start the OAuth flow. Two modes:
//  1. redirect_url present → redirect straight to Odoo's callback with
//     code + shop_id, skipping any intermediate hop.
//  2. redirect_url absent  → return a JSON auth_url pointing to this
//     server's own callback so Odoo can open it in a browser tab.
// ─────────────────────────────────────────────────────────────────────
app.get('/api/v2/shop/auth_partner', (req, res) => {
  const { redirect_url } = req.query;
  if (redirect_url) {
    const sep = redirect_url.includes('?') ? '&' : '?';
    return res.redirect(`${redirect_url}${sep}code=MOCK_AUTH_CODE_2026&shop_id=${DB.shop.shop_id}`);
  }
  // No redirect_url: return a self-contained auth URL Odoo can open
  const auth_url = `${req.protocol}://${req.get('host')}/api/v2/auth/callback?code=MOCK_AUTH_CODE_2026&shop_id=${DB.shop.shop_id}`;
  res.json({ error: '', message: '', request_id: rid(), response: { auth_url } });
});

// ─────────────────────────────────────────────────────────────────────
//  AUTH — get_auth_link
//
//  Same dual-mode logic as auth_partner above.
// ─────────────────────────────────────────────────────────────────────
app.get('/api/v2/auth/shop/get_auth_link', (req, res) => {
  const { redirect_url } = req.query;
  if (redirect_url) {
    const sep      = redirect_url.includes('?') ? '&' : '?';
    const auth_url = `${redirect_url}${sep}code=MOCK_AUTH_CODE_2026&shop_id=${DB.shop.shop_id}`;
    return res.json({ error: '', message: '', request_id: rid(), response: { auth_url } });
  }
  // No redirect_url: return a self-contained auth URL Odoo can open
  const auth_url = `${req.protocol}://${req.get('host')}/api/v2/auth/callback?code=MOCK_AUTH_CODE_2026&shop_id=${DB.shop.shop_id}`;
  res.json({ error: '', message: '', request_id: rid(), response: { auth_url } });
});

// ─────────────────────────────────────────────────────────────────────
//  AUTH — callback (fallback for when no redirect_url is provided)
// ─────────────────────────────────────────────────────────────────────
app.get('/api/v2/auth/callback', (req, res) => {
  const { redirect, code, shop_id } = req.query;
  if (redirect) {
    const sep = redirect.includes('?') ? '&' : '?';
    return res.redirect(`${redirect}${sep}code=${code}&shop_id=${shop_id}`);
  }
  res.json({ code, shop_id, message: 'Authorization complete.' });
});

// ─────────────────────────────────────────────────────────────────────
//  AUTH — Token exchange
// ─────────────────────────────────────────────────────────────────────
app.post('/api/v2/auth/token/get', (req, res) => {
  res.json({
    error: '', message: '', request_id: rid(),
    response: {
      access_token:      'MOCK_ACCESS_TOKEN_' + Date.now(),
      refresh_token:     'MOCK_REFRESH_TOKEN_' + Date.now(),
      expire_in:         86400,
      refresh_expire_in: 2592000,
      shop_id_list:      [DB.shop.shop_id],
      merchant_id_list:  [],
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
//  AUTH — Token refresh
// ─────────────────────────────────────────────────────────────────────
app.post('/api/v2/auth/access_token/get', (req, res) => {
  res.json({
    error: '', message: '', request_id: rid(),
    response: {
      access_token:  'MOCK_ACCESS_TOKEN_REFRESHED_' + Date.now(),
      refresh_token: 'MOCK_REFRESH_TOKEN_REFRESHED_' + Date.now(),
      expire_in:     86400,
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
//  SHOP — get_shop_info
// ─────────────────────────────────────────────────────────────────────
app.get('/api/v2/shop/get_shop_info', requireAuth, (req, res) => {
  res.json({ error: '', message: '', request_id: rid(), response: DB.shop });
});

// ─────────────────────────────────────────────────────────────────────
//  PRODUCTS — get_item_list
// ─────────────────────────────────────────────────────────────────────
app.get('/api/v2/product/get_item_list', requireAuth, (req, res) => {
  const offset     = parseInt(req.query.offset)    || 0;
  const pageSize   = parseInt(req.query.page_size) || 50;
  const itemStatus = req.query.item_status          || 'NORMAL';

  const filtered = DB.products.filter(p => p.status === itemStatus || itemStatus === 'ALL');
  const page     = filtered.slice(offset, offset + pageSize);
  const hasMore  = offset + pageSize < filtered.length;

  res.json({
    error: '', message: '', request_id: rid(),
    response: {
      item:          page.map(p => ({ item_id: p.item_id, item_status: p.status })),
      total_count:   filtered.length,
      has_next_page: hasMore,
      next_offset:   hasMore ? offset + pageSize : null,
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
//  PRODUCTS — get_item_base_info
// ─────────────────────────────────────────────────────────────────────
app.get('/api/v2/product/get_item_base_info', requireAuth, (req, res) => {
  const raw   = req.query.item_id_list || '';
  const ids   = raw.split(',').map(Number).filter(Boolean);
  const items = ids.length
    ? DB.products.filter(p => ids.includes(p.item_id))
    : DB.products;

  res.json({
    error: '', message: '', request_id: rid(),
    response: {
      item_list: items.map(p => ({
        item_id:     p.item_id,
        item_name:   p.name,
        description: p.description,
        category_id: p.category_id,
        item_status: p.status,
        price_info: [{
          currency:       'PHP',
          original_price: p.price,
          current_price:  p.price,
          inflated_price_of_original_price: p.price,
        }],
        stock_info_v2: {
          summary_info: {
            total_reserved_stock:  0,
            total_available_stock: p.stock,
          }
        },
        sku: p.sku,
        image: {
          image_url_list: [
            `https://placehold.co/400x400/EE4D2D/fff?text=${encodeURIComponent(p.sku)}`
          ]
        }
      }))
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
//  ORDERS — get_order_list
// ─────────────────────────────────────────────────────────────────────
app.get('/api/v2/order/get_order_list', requireAuth, (req, res) => {
  const timeFrom    = parseInt(req.query.time_range_field === 'update_time' ? req.query.update_time_from : req.query.create_time_from) || 0;
  const timeTo      = parseInt(req.query.time_range_field === 'update_time' ? req.query.update_time_to   : req.query.create_time_to)   || ts();
  const orderStatus = req.query.order_status;

  let orders = DB.orders.filter(o => o.create_time >= timeFrom && o.create_time <= timeTo);
  if (orderStatus) orders = orders.filter(o => o.order_status === orderStatus);

  res.json({
    error: '', message: '', request_id: rid(),
    response: {
      order_list: orders.map(o => ({
        order_sn:     o.order_sn,
        order_status: o.order_status,
        create_time:  o.create_time,
        update_time:  o.update_time,
      })),
      more:        false,
      next_cursor: '',
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
//  ORDERS — get_order_detail
// ─────────────────────────────────────────────────────────────────────
app.get('/api/v2/order/get_order_detail', requireAuth, (req, res) => {
  const raw  = req.query.order_sn_list || '';
  const sns  = raw.split(',').map(s => s.trim()).filter(Boolean);
  const list = sns.length
    ? DB.orders.filter(o => sns.includes(o.order_sn))
    : DB.orders;

  res.json({
    error: '', message: '', request_id: rid(),
    response: {
      order_list: list.map(o => ({
        ...o,
        message_to_seller:         '',
        note:                      '',
        pay_time:                  o.create_time + 300,
        days_to_ship:              3,
        ship_by_date:              o.create_time + 86400 * 3,
        invoice_data:              null,
        checkout_shipping_carrier: 'SPX Express',
        actual_shipping_cost:      0,
        total_amount:              o.actual_price,
      }))
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
//  LOGISTICS — get_shipping_parameter
// ─────────────────────────────────────────────────────────────────────
app.get('/api/v2/logistics/get_shipping_parameter', requireAuth, (req, res) => {
  const { order_sn } = req.query;
  res.json({
    error: '', message: '', request_id: rid(),
    response: {
      order_sn,
      pickup: {
        address_list: [{
          address_id: 1,
          address:    '123 Mock Warehouse St, Manila, PH',
          time_slot_list: [{
            pickup_time_id: 'slot_001',
            date:           new Date().toISOString().split('T')[0],
            time_text:      '9:00 AM - 12:00 PM',
          }]
        }]
      },
      dropoff:        { branch_list: [] },
      non_integrated: null,
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
//  LOGISTICS — ship_order
// ─────────────────────────────────────────────────────────────────────
app.post('/api/v2/logistics/ship_order', requireAuth, (req, res) => {
  const { order_sn } = req.body;
  const order = DB.orders.find(o => o.order_sn === order_sn);
  if (!order) {
    return res.json({ error: 'order_not_found', message: `Order ${order_sn} not found.`, request_id: rid(), response: {} });
  }
  const tracking     = 'PHSPX' + Date.now();
  order.tracking_no  = tracking;
  order.order_status = 'SHIPPED';
  order.update_time  = ts();
  order.item_list.forEach(item => {
    const product = DB.products.find(p => p.item_id === item.item_id);
    if (product) product.stock = Math.max(0, product.stock - item.model_quantity_purchased);
  });
  res.json({
    error: '', message: '', request_id: rid(),
    response: { hint_message: 'Shipment initiated successfully.' }
  });
});

// ─────────────────────────────────────────────────────────────────────
//  LOGISTICS — init_shipment
// ─────────────────────────────────────────────────────────────────────
app.post('/api/v2/logistics/init_shipment', requireAuth, (req, res) => {
  const { order_sn } = req.body;
  const order = DB.orders.find(o => o.order_sn === order_sn);
  if (!order) {
    return res.json({ error: 'order_not_found', message: `Order ${order_sn} not found.`, request_id: rid(), response: {} });
  }
  const tracking     = 'PHSPX' + Date.now();
  order.tracking_no  = tracking;
  order.order_status = 'SHIPPED';
  order.update_time  = ts();
  res.json({
    error: '', message: '', request_id: rid(),
    response: {
      order_sn,
      tracking_number: tracking,
      hint_message:    'Shipment initiated successfully.',
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
//  LOGISTICS — get_tracking_number
// ─────────────────────────────────────────────────────────────────────
app.get('/api/v2/logistics/get_tracking_number', requireAuth, (req, res) => {
  const { order_sn } = req.query;
  const order    = DB.orders.find(o => o.order_sn === order_sn);
  const tracking = order ? (order.tracking_no || 'PHSPX' + Date.now()) : 'PHSPX' + Date.now();
  res.json({
    error: '', message: '', request_id: rid(),
    response: { tracking_number: tracking, plp_number: '', hint_message: '' }
  });
});

// ─────────────────────────────────────────────────────────────────────
//  LOGISTICS — create_shipping_document
// ─────────────────────────────────────────────────────────────────────
app.post('/api/v2/logistics/create_shipping_document', requireAuth, (req, res) => {
  const { order_list } = req.body;
  res.json({
    error: '', message: '', request_id: rid(),
    response: {
      result_list: (order_list || []).map(o => ({
        order_sn:     o.order_sn,
        status:       'READY',
        fail_error:   '',
        fail_message: '',
      }))
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
//  LOGISTICS — get_shipping_document_result
// ─────────────────────────────────────────────────────────────────────
app.get('/api/v2/logistics/get_shipping_document_result', requireAuth, (req, res) => {
  const raw = req.query.order_list || '[]';
  let orders = [];
  try { orders = JSON.parse(raw); } catch (e) {}
  res.json({
    error: '', message: '', request_id: rid(),
    response: {
      result_list: orders.map(o => ({
        order_sn:     o.order_sn,
        status:       'READY',
        fail_error:   '',
        fail_message: '',
      }))
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
//  LOGISTICS — download_shipping_document
// ─────────────────────────────────────────────────────────────────────
app.post('/api/v2/logistics/download_shipping_document', requireAuth, (req, res) => {
  res.json({
    error: '', message: '', request_id: rid(),
    response: { file_type: 'PDF', file_url: `${req.protocol}://${req.get('host')}/mock-label.pdf` }
  });
});

// ─────────────────────────────────────────────────────────────────────
//  PRODUCT — update_stock
// ─────────────────────────────────────────────────────────────────────
app.post('/api/v2/product/update_stock', requireAuth, (req, res) => {
  const { item_id, stock_list } = req.body;
  const product = DB.products.find(p => p.item_id === item_id);
  if (!product) {
    return res.json({ error: 'item_not_found', message: `Item ${item_id} not found.`, request_id: rid(), response: {} });
  }
  if (stock_list && stock_list[0]) {
    const newStock = stock_list[0].normal_stock;
    console.log(`[STOCK SYNC] ${product.sku} (${product.name}): ${product.stock} → ${newStock}`);
    product.stock = newStock;
  }
  res.json({
    error: '', message: '', request_id: rid(),
    response: { item_id, update_time: ts() }
  });
});

// ─────────────────────────────────────────────────────────────────────
//  WEBHOOK RECEIVER
// ─────────────────────────────────────────────────────────────────────
app.post('/webhook/push', (req, res) => {
  console.log('[WEBHOOK RECEIVED]', JSON.stringify(req.body, null, 2));
  res.json({ code: 0, message: 'success', request_id: rid() });
});

// ─────────────────────────────────────────────────────────────────────
//  404 catch-all
// ─────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error:      'endpoint_not_found',
    message:    `${req.method} ${req.path} is not implemented in this mock.`,
    request_id: rid(),
  });
});

app.listen(PORT, () => {
  console.log(`\n🟠 Shopee Mock API running on port ${PORT}`);
  console.log(`   Partner ID  : ${PARTNER_ID}`);
  console.log(`   Partner Key : ${PARTNER_KEY}`);
  console.log(`   Strict sig  : ${process.env.STRICT_SIG || 'false (demo mode)'}\n`);
});
