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
 * ║    GET  /api/v2/auth/shop/get_auth_link  (OAuth redirect)    ║
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
// Shopee signs requests as: HMAC-SHA256(partner_id + api_path + timestamp + access_token + shop_id)
function verifySignature(req) {
  // In demo mode, accept any request with the correct partner_id
  // Set STRICT_SIG=true in env to enforce real HMAC checking
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
    { item_id: 10001, name: "Lay's Classic Salted Chips 60g", description: "Snacks / Chips — Lay\'s Classic Salted Chips 60g", category_id: 100, price: 62, stock: 100, sku: 'LAYS-001', barcode: '4800888101001', status: 'NORMAL' },
    { item_id: 10002, name: "Lay's Cheese & Onion Chips 60g", description: "Snacks / Chips — Lay\'s Cheese & Onion Chips 60g", category_id: 100, price: 62, stock: 100, sku: 'LAYS-002', barcode: '4800888101002', status: 'NORMAL' },
    { item_id: 10003, name: "Lay's BBQ Chips 60g", description: "Snacks / Chips — Lay\'s BBQ Chips 60g", category_id: 100, price: 62, stock: 100, sku: 'LAYS-003', barcode: '4800888101003', status: 'NORMAL' },
    { item_id: 10004, name: "Lay's Sour Cream & Onion 85g", description: "Snacks / Chips — Lay\'s Sour Cream & Onion 85g", category_id: 100, price: 89, stock: 100, sku: 'LAYS-004', barcode: '4800888101004', status: 'NORMAL' },
    { item_id: 10005, name: "Cheetos Crunchy 80g", description: "Snacks / Chips — Cheetos Crunchy 80g", category_id: 100, price: 62, stock: 100, sku: 'CHTO-001', barcode: '4800888102001', status: 'NORMAL' },
    { item_id: 10006, name: "Cheetos Puffs 80g", description: "Snacks / Chips — Cheetos Puffs 80g", category_id: 100, price: 62, stock: 100, sku: 'CHTO-002', barcode: '4800888102002', status: 'NORMAL' },
    { item_id: 10007, name: "Cheetos Flamin' Hot 80g", description: "Snacks / Chips — Cheetos Flamin\' Hot 80g", category_id: 100, price: 62, stock: 100, sku: 'CHTO-003', barcode: '4800888102003', status: 'NORMAL' },
    { item_id: 10008, name: "Doritos Nacho Cheese 100g", description: "Snacks / Chips — Doritos Nacho Cheese 100g", category_id: 100, price: 75, stock: 100, sku: 'DORI-001', barcode: '4800888103001', status: 'NORMAL' },
    { item_id: 10009, name: "Doritos Cool Ranch 100g", description: "Snacks / Chips — Doritos Cool Ranch 100g", category_id: 100, price: 75, stock: 100, sku: 'DORI-002', barcode: '4800888103002', status: 'NORMAL' },
    { item_id: 10010, name: "Doritos Spicy Sweet Chili 100g", description: "Snacks / Chips — Doritos Spicy Sweet Chili 100g", category_id: 100, price: 75, stock: 100, sku: 'DORI-003', barcode: '4800888103003', status: 'NORMAL' },
    { item_id: 10011, name: "Quaker Oats 800g", description: "Breakfast / Cereals — Quaker Oats 800g", category_id: 200, price: 149, stock: 100, sku: 'QKRO-001', barcode: '4800888104001', status: 'NORMAL' },
    { item_id: 10012, name: "Quaker Instant Oatmeal Sachet 40g", description: "Breakfast / Cereals — Quaker Instant Oatmeal Sachet 40g", category_id: 200, price: 35, stock: 100, sku: 'QKRO-002', barcode: '4800888104002', status: 'NORMAL' },
    { item_id: 10013, name: "Quaker Oats Granola Honey 400g", description: "Breakfast / Cereals — Quaker Oats Granola Honey 400g", category_id: 200, price: 189, stock: 100, sku: 'QKRO-003', barcode: '4800888104003', status: 'NORMAL' },
    { item_id: 10014, name: "Quaker Chewy Granola Bar Choc Chip 42g", description: "Snacks / Bars — Quaker Chewy Granola Bar Choc Chip 42g", category_id: 101, price: 45, stock: 100, sku: 'QKRO-004', barcode: '4800888104004', status: 'NORMAL' },
    { item_id: 10015, name: "M&M's Milk Chocolate 100g", description: "Confectionery / Chocolate — M&M\'s Milk Chocolate 100g", category_id: 300, price: 129, stock: 100, sku: 'MNMS-001', barcode: '4800888105001', status: 'NORMAL' },
    { item_id: 10016, name: "M&M's Peanut 100g", description: "Confectionery / Chocolate — M&M\'s Peanut 100g", category_id: 300, price: 129, stock: 100, sku: 'MNMS-002', barcode: '4800888105002', status: 'NORMAL' },
    { item_id: 10017, name: "M&M's Crispy 100g", description: "Confectionery / Chocolate — M&M\'s Crispy 100g", category_id: 300, price: 129, stock: 100, sku: 'MNMS-003', barcode: '4800888105003', status: 'NORMAL' },
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
      order_sn:         'SPX20260521001',
      order_status:     'READY_TO_SHIP',
      create_time:      ts() - 3600,
      update_time:      ts() - 1800,
      buyer_username:   'juan_delacruz',
      recipient_name:   'Juan Dela Cruz',
      actual_price:     515,
      currency:         'PHP',
      tracking_no:      '',
      item_list: [
        { item_id: 10001, item_name: "Lay's Classic Salted Chips 60g", model_sku: 'LAYS-001', model_quantity_purchased: 3, model_discounted_price: 62 },
        { item_id: 10008, item_name: "Doritos Nacho Cheese 100g",       model_sku: 'DORI-001', model_quantity_purchased: 2, model_discounted_price: 75 },
        { item_id: 10015, item_name: "M&M's Milk Chocolate 100g",       model_sku: 'MNMS-001', model_quantity_purchased: 1, model_discounted_price: 129 },
      ],
    },
    {
      order_sn:         'SPX20260521002',
      order_status:     'SHIPPED',
      create_time:      ts() - 86400,
      update_time:      ts() - 43200,
      buyer_username:   'maria_santos',
      recipient_name:   'Maria Santos',
      actual_price:     874,
      currency:         'PHP',
      tracking_no:      'PHSPX1234567890',
      item_list: [
        { item_id: 10021, item_name: "Nutella Hazelnut Spread 350g", model_sku: 'NUTE-001', model_quantity_purchased: 2, model_discounted_price: 259 },
        { item_id: 10035, item_name: "Ferrero Rocher 3pcs Box",       model_sku: 'FERR-001', model_quantity_purchased: 4, model_discounted_price: 89 },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────
//  ROOT — health check
// ─────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    service:    'Shopee Mock API Server',
    version:    '2.0.0',
    status:     'ok',
    timestamp:  ts(),
    partner_id: PARTNER_ID,
    note:       'Paste this server base URL into Odoo → Shopee API Endpoint field.',
    endpoints:  [
      'POST /api/v2/auth/token/get',
      'GET  /api/v2/auth/shop/get_auth_link',
      'GET  /api/v2/shop/get_shop_info',
      'GET  /api/v2/product/get_item_list',
      'GET  /api/v2/product/get_item_base_info',
      'GET  /api/v2/order/get_order_list',
      'GET  /api/v2/order/get_order_detail',
      'POST /api/v2/logistics/init_shipment',
    ]
  });
});

// ─────────────────────────────────────────────────────────────────────
//  AUTH  — OAuth authorization link
// ─────────────────────────────────────────────────────────────────────
// Odoo calls this to build the "Authorize Shop" redirect URL
app.get('/api/v2/auth/shop/get_auth_link', (req, res) => {
  const { redirect_url } = req.query;
  // Return a mock auth URL that immediately redirects back to Odoo with a code
  const authUrl = `${req.protocol}://${req.get('host')}/api/v2/auth/callback?code=MOCK_AUTH_CODE_2026&shop_id=${DB.shop.shop_id}&redirect=${encodeURIComponent(redirect_url || '')}`;
  res.json({
    error:      '',
    message:    '',
    request_id: rid(),
    response:   { auth_url: authUrl }
  });
});

// ─────────────────────────────────────────────────────────────────────
//  AUTH  — OAuth callback (mock redirect back to Odoo)
// ─────────────────────────────────────────────────────────────────────
app.get('/api/v2/auth/callback', (req, res) => {
  const { redirect, code, shop_id } = req.query;
  if (redirect) {
    const sep = redirect.includes('?') ? '&' : '?';
    return res.redirect(`${redirect}${sep}code=${code}&shop_id=${shop_id}`);
  }
  res.json({ code, shop_id, message: 'No redirect_url provided.' });
});

// ─────────────────────────────────────────────────────────────────────
//  AUTH  — Token exchange
// ─────────────────────────────────────────────────────────────────────
// Odoo exchanges the auth code for access_token + refresh_token
app.post('/api/v2/auth/token/get', (req, res) => {
  const body = req.body;
  // Accept any code in demo mode
  res.json({
    error:      '',
    message:    '',
    request_id: rid(),
    response: {
      access_token:    'MOCK_ACCESS_TOKEN_' + Date.now(),
      refresh_token:   'MOCK_REFRESH_TOKEN_' + Date.now(),
      expire_in:       86400,
      refresh_expire_in: 2592000,
      shop_id_list:    [DB.shop.shop_id],
      merchant_id_list:[],
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
//  AUTH  — Token refresh
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
//  SHOP  — get_shop_info
// ─────────────────────────────────────────────────────────────────────
app.get('/api/v2/shop/get_shop_info', requireAuth, (req, res) => {
  res.json({
    error: '', message: '', request_id: rid(),
    response: DB.shop
  });
});

// ─────────────────────────────────────────────────────────────────────
//  PRODUCTS  — get_item_list
// ─────────────────────────────────────────────────────────────────────
app.get('/api/v2/product/get_item_list', requireAuth, (req, res) => {
  const offset    = parseInt(req.query.offset)     || 0;
  const pageSize  = parseInt(req.query.page_size)  || 50;
  const itemStatus= req.query.item_status           || 'NORMAL';

  const filtered = DB.products.filter(p => p.status === itemStatus || itemStatus === 'ALL');
  const page     = filtered.slice(offset, offset + pageSize);
  const hasMore  = offset + pageSize < filtered.length;

  res.json({
    error: '', message: '', request_id: rid(),
    response: {
      item:      page.map(p => ({ item_id: p.item_id, item_status: p.status })),
      total_count: filtered.length,
      has_next_page: hasMore,
      next_offset:   hasMore ? offset + pageSize : null,
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
//  PRODUCTS  — get_item_base_info
// ─────────────────────────────────────────────────────────────────────
app.get('/api/v2/product/get_item_base_info', requireAuth, (req, res) => {
  const raw     = req.query.item_id_list || '';
  const ids     = raw.split(',').map(Number).filter(Boolean);
  const items   = ids.length
    ? DB.products.filter(p => ids.includes(p.item_id))
    : DB.products;

  res.json({
    error: '', message: '', request_id: rid(),
    response: {
      item_list: items.map(p => ({
        item_id:      p.item_id,
        item_name:    p.name,
        description:  p.description,
        category_id:  p.category_id,
        item_status:  p.status,
        price_info: [{
          currency:         'PHP',
          original_price:   p.price,
          current_price:    p.price,
          inflated_price_of_original_price: p.price,
        }],
        stock_info_v2: {
          summary_info: {
            total_reserved_stock: 0,
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
//  ORDERS  — get_order_list
// ─────────────────────────────────────────────────────────────────────
app.get('/api/v2/order/get_order_list', requireAuth, (req, res) => {
  const pageSize   = parseInt(req.query.page_size) || 20;
  const timeFrom   = parseInt(req.query.time_range_field === 'update_time' ? req.query.update_time_from : req.query.create_time_from) || 0;
  const timeTo     = parseInt(req.query.time_range_field === 'update_time' ? req.query.update_time_to   : req.query.create_time_to)   || ts();
  const orderStatus= req.query.order_status;

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
      more:       false,
      next_cursor: '',
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
//  ORDERS  — get_order_detail
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
        message_to_seller: '',
        note:              '',
        pay_time:          o.create_time + 300,
        days_to_ship:      3,
        ship_by_date:      o.create_time + 86400 * 3,
        invoice_data:      null,
        checkout_shipping_carrier: 'SPX Express',
        actual_shipping_cost: 0,
        total_amount: o.actual_price,
      }))
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
//  LOGISTICS  — init_shipment
// ─────────────────────────────────────────────────────────────────────
app.post('/api/v2/logistics/init_shipment', requireAuth, (req, res) => {
  const { order_sn } = req.body;
  const order = DB.orders.find(o => o.order_sn === order_sn);
  if (!order) {
    return res.json({ error: 'order_not_found', message: `Order ${order_sn} not found.`, request_id: rid(), response: {} });
  }
  const tracking = 'PHSPX' + Date.now();
  order.tracking_no    = tracking;
  order.order_status   = 'SHIPPED';
  order.update_time    = ts();

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
//  WEBHOOK RECEIVER  (Odoo-side simulation)
// ─────────────────────────────────────────────────────────────────────
app.post('/webhook/push', (req, res) => {
  const payload = req.body;
  console.log('[WEBHOOK RECEIVED]', JSON.stringify(payload, null, 2));
  res.json({ code: 0, message: 'success', request_id: rid() });
});

// ─────────────────────────────────────────────────────────────────────
//  404 catch-all
// ─────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error:   'endpoint_not_found',
    message: `${req.method} ${req.path} is not implemented in this mock.`,
    request_id: rid(),
  });
});

app.listen(PORT, () => {
  console.log(`\n🟠 Shopee Mock API running on port ${PORT}`);
  console.log(`   Partner ID  : ${PARTNER_ID}`);
  console.log(`   Partner Key : ${PARTNER_KEY}`);
  console.log(`   Strict sig  : ${process.env.STRICT_SIG || 'false (demo mode)'}\n`);
});
