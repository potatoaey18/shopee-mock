/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  SHOPEE MOCK API SERVER  v4.0                                ║
 * ║  Mimics Shopee Open Platform API for Odoo integration demo   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

const express = require('express');
const crypto  = require('crypto');
const app     = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── CONFIG ────────────────────────────────────────────────────────────
const PARTNER_ID    = process.env.PARTNER_ID    || '1';
const PARTNER_KEY   = process.env.PARTNER_KEY   || '1';
const PORT          = process.env.PORT          || 3000;
const ODOO_BASE_URL = (process.env.ODOO_BASE_URL || '').replace(/\/$/, '');

// ── HELPERS ───────────────────────────────────────────────────────────
function verifySignature(req) {
  if (process.env.STRICT_SIG !== 'true') return true;
  const { partner_id, timestamp, sign } = req.query;
  if (!partner_id || !timestamp || !sign) return false;
  if (String(partner_id) !== String(PARTNER_ID)) return false;
  const path      = req.path;
  const shopId    = req.query.shop_id      || '';
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

function rid()    { return 'mock_' + Math.random().toString(36).slice(2, 10).toUpperCase(); }
function ts()     { return Math.floor(Date.now() / 1000); }
function nowStr() { return new Date().toISOString().replace('T', ' ').substring(0, 19); }

// ── ODOO WEBHOOK NOTIFIER ─────────────────────────────────────────────
async function notifyOdooDelivered(order_sn) {
  if (!ODOO_BASE_URL) {
    console.warn(`[WEBHOOK] ODOO_BASE_URL not set — skipping delivery notification for ${order_sn}`);
    return;
  }
  const candidatePaths = [
    '/shopee/webhook',
    '/web/shopee/webhook',
    '/shopee_connector/webhook',
    '/web/action/shopee_connector.action_shopee_webhook',
  ];
  const payload = {
    code: 3,
    timestamp: ts(),
    shop_id: DB.shop.shop_id,
    data: { ordersn: order_sn, status: 'COMPLETED', update_time: ts() },
  };
  for (const path of candidatePaths) {
    const url = `${ODOO_BASE_URL}${path}`;
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });
      if (resp.ok) { console.log(`[WEBHOOK] ✅ Odoo notified at ${url} — order ${order_sn} COMPLETED`); return; }
      console.warn(`[WEBHOOK] ${url} responded ${resp.status} — trying next path`);
    } catch (err) {
      console.warn(`[WEBHOOK] ${url} unreachable — ${err.message}`);
    }
  }
  console.warn(`[WEBHOOK] ⚠️  All Odoo webhook paths failed for ${order_sn}.`);
}

// ── PDF GENERATOR ─────────────────────────────────────────────────────
function buildShippingLabelPDF(order, tracking) {
  const safe = s => String(s || '').replace(/[()\\]/g, c => '\\' + c);
  const addr = order.recipient_address;
  const items = order.item_list.map(i =>
    `${i.item_name.substring(0, 38)} x${i.model_quantity_purchased}`
  ).join(' | ');

  const streamLines = [
    // Header bar (simulated with text)
    '/F2 13 Tf 30 295 Td (SHOPEE EXPRESS — SHIPPING LABEL) Tj',
    '/F1 9 Tf 0 -18 Td (Order: ' + safe(order.order_sn) + ') Tj',
    '0 -13 Td (Carrier: ' + safe(order.shipping_carrier) + ') Tj',
    '/F2 11 Tf 0 -20 Td (Tracking Number:) Tj',
    '/F2 14 Tf 0 -18 Td (' + safe(tracking) + ') Tj',
    '/F2 10 Tf 0 -22 Td (DELIVER TO:) Tj',
    '/F1 11 Tf 0 -15 Td (' + safe(addr.name) + ') Tj',
    '/F1 9 Tf 0 -13 Td (' + safe(addr.phone) + ') Tj',
    '0 -13 Td (' + safe(addr.full_address.substring(0, 65)) + ') Tj',
    '/F2 9 Tf 0 -20 Td (ITEMS:) Tj',
    '/F1 9 Tf 0 -13 Td (' + safe(items.substring(0, 70)) + ') Tj',
    '/F2 9 Tf 0 -22 Td (Amount: PHP ' + safe(order.total_amount) + ') Tj',
    '/F1 8 Tf 0 -30 Td (MOCK LABEL — Shopee Demo Environment) Tj',
  ].join('\n');

  const stream    = `BT\n${streamLines}\nET`;
  const streamLen = Buffer.byteLength(stream, 'utf8');

  const obj1 = '1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n';
  const obj2 = '2 0 obj\n<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n';
  const obj3 = '3 0 obj\n<</Type/Page/MediaBox[0 0 420 340]/Parent 2 0 R/Contents 6 0 R/Resources<</Font<</F1 4 0 R/F2 5 0 R>>>>>>\nendobj\n';
  const obj4 = '4 0 obj\n<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>\nendobj\n';
  const obj5 = '5 0 obj\n<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold>>\nendobj\n';
  const obj6 = `6 0 obj\n<</Length ${streamLen}>>\nstream\n${stream}\nendstream\nendobj\n`;

  const header   = '%PDF-1.4\n';
  let   pos      = header.length;
  const offsets  = [];
  const objs     = [obj1, obj2, obj3, obj4, obj5, obj6];
  objs.forEach(o => { offsets.push(pos); pos += o.length; });

  const xrefPos = pos;
  const xref    = ['xref\n', `0 ${objs.length + 1}\n`, '0000000000 65535 f \n',
    ...offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`)].join('');
  const trailer = `trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xrefPos}\n%%EOF`;

  return Buffer.from(header + objs.join('') + xref + trailer, 'utf8');
}

// ── ODOO CALLBACK RESOLVER ────────────────────────────────────────────
function resolveOdooCallback(req, extraParams) {
  const ODOO_CALLBACK_PATH = '/web/action/shopee_connector.action_shopee_auth_callback';
  let odooBase = ODOO_BASE_URL;
  if (!odooBase) {
    const referer = req.get('Referer') || req.get('Origin') || '';
    if (referer) { try { const u = new URL(referer); odooBase = `${u.protocol}//${u.host}`; } catch (_) {} }
  }
  if (!odooBase) {
    const self = `${req.protocol}://${req.get('host')}`;
    return `${self}/api/v2/auth/callback?${new URLSearchParams(extraParams).toString()}`;
  }
  return `${odooBase}${ODOO_CALLBACK_PATH}?${new URLSearchParams(extraParams).toString()}`;
}

function buildAuthUrl(req) {
  const { redirect, redirect_url } = req.query;
  const self = `${req.protocol}://${req.get('host')}`;
  const odooCallback = redirect || redirect_url
    || (ODOO_BASE_URL ? `${ODOO_BASE_URL}/web/action/shopee_connector.action_shopee_auth_callback` : null);
  const params = new URLSearchParams({
    shop_id: DB.shop.shop_id,
    code:    'MOCK_AUTH_CODE_2026',
    ...(odooCallback ? { redirect_url: odooCallback } : {}),
  });
  return `${self}/api/v2/auth/authorize?${params.toString()}`;
}

// ── DELIVERY STATUS STEPS ─────────────────────────────────────────────
const DELIVERY_STEPS = ['Order Placed', 'Picked Up', 'In Transit', 'Out for Delivery', 'Delivered'];

// ── IN-MEMORY DATA STORE ──────────────────────────────────────────────
const DB = {
  shop: {
    shop_id:     123456,
    shop_name:   'Demo Shopee Store PH',
    region:      'PH',
    status:      'NORMAL',
    is_cb:       false,
    auth_time:   ts(),
    expire_time: ts() + 86400 * 30,
    description: 'Mock Shopee shop for Odoo demo integration.',
  },

  products: [
    { item_id: 10001, model_id: 0, name: "Lay's Classic Salted Chips 60g",           sku: 'LAYS-001', price: 62,  category: 'Snacks' },
    { item_id: 10002, model_id: 0, name: "Lay's Cheese & Onion Chips 60g",           sku: 'LAYS-002', price: 65,  category: 'Snacks' },
    { item_id: 10003, model_id: 0, name: "Lay's BBQ Chips 60g",                      sku: 'LAYS-003', price: 65,  category: 'Snacks' },
    { item_id: 10004, model_id: 0, name: "Lay's Sour Cream & Onion 85g",             sku: 'LAYS-004', price: 75,  category: 'Snacks' },
    { item_id: 10005, model_id: 0, name: "Cheetos Crunchy 80g",                      sku: 'CHTO-001', price: 62,  category: 'Snacks' },
    { item_id: 10006, model_id: 0, name: "Cheetos Puffs 80g",                        sku: 'CHTO-002', price: 62,  category: 'Snacks' },
    { item_id: 10007, model_id: 0, name: "Cheetos Flamin' Hot 80g",                  sku: 'CHTO-003', price: 68,  category: 'Snacks' },
    { item_id: 10008, model_id: 0, name: "Doritos Nacho Cheese 100g",                sku: 'DORI-001', price: 75,  category: 'Snacks' },
    { item_id: 10009, model_id: 0, name: "Doritos Cool Ranch 100g",                  sku: 'DORI-002', price: 75,  category: 'Snacks' },
    { item_id: 10010, model_id: 0, name: "Doritos Spicy Sweet Chili 100g",           sku: 'DORI-003', price: 78,  category: 'Snacks' },
    { item_id: 10011, model_id: 0, name: "Quaker Oats 800g",                         sku: 'QKRO-001', price: 149, category: 'Breakfast' },
    { item_id: 10012, model_id: 0, name: "Quaker Instant Oatmeal Sachet 40g",        sku: 'QKRO-002', price: 35,  category: 'Breakfast' },
    { item_id: 10013, model_id: 0, name: "Quaker Oats Granola Honey 400g",           sku: 'QKRO-003', price: 189, category: 'Breakfast' },
    { item_id: 10014, model_id: 0, name: "Quaker Chewy Granola Bar Choc Chip 42g",   sku: 'QKRO-004', price: 45,  category: 'Breakfast' },
    { item_id: 10015, model_id: 0, name: "M&M's Milk Chocolate 100g",                sku: 'MNMS-001', price: 129, category: 'Candy' },
    { item_id: 10016, model_id: 0, name: "M&M's Peanut 100g",                        sku: 'MNMS-002', price: 129, category: 'Candy' },
    { item_id: 10017, model_id: 0, name: "M&M's Crispy 100g",                        sku: 'MNMS-003', price: 135, category: 'Candy' },
    { item_id: 10018, model_id: 0, name: "Snickers Bar 52g",                         sku: 'SNIC-001', price: 55,  category: 'Candy' },
    { item_id: 10019, model_id: 0, name: "Snickers Peanut Butter Bar 52g",           sku: 'SNIC-002', price: 60,  category: 'Candy' },
    { item_id: 10020, model_id: 0, name: "Snickers Miniatures 240g",                 sku: 'SNIC-003', price: 259, category: 'Candy' },
    { item_id: 10021, model_id: 0, name: "Nutella Hazelnut Spread 350g",              sku: 'NUTE-001', price: 259, category: 'Spreads' },
    { item_id: 10022, model_id: 0, name: "Nutella Hazelnut Spread 750g",              sku: 'NUTE-002', price: 459, category: 'Spreads' },
    { item_id: 10023, model_id: 0, name: "Nutella & Go Snack Pack 48g",               sku: 'NUTE-003', price: 85,  category: 'Spreads' },
    { item_id: 10024, model_id: 0, name: "Tic Tac Orange 16g",                       sku: 'TICT-001', price: 25,  category: 'Candy' },
    { item_id: 10025, model_id: 0, name: "Tic Tac Mint 16g",                         sku: 'TICT-002', price: 25,  category: 'Candy' },
    { item_id: 10026, model_id: 0, name: "Tic Tac Strawberry 16g",                   sku: 'TICT-003', price: 25,  category: 'Candy' },
    { item_id: 10027, model_id: 0, name: "Tic Tac Lime & Orange Mix 16g",            sku: 'TICT-004', price: 28,  category: 'Candy' },
    { item_id: 10028, model_id: 0, name: "Loacker Classic Vanilla 175g",             sku: 'LOAC-001', price: 155, category: 'Biscuits' },
    { item_id: 10029, model_id: 0, name: "Loacker Chocolate Wafer 175g",             sku: 'LOAC-002', price: 155, category: 'Biscuits' },
    { item_id: 10030, model_id: 0, name: "Loacker Hazelnut Wafer 175g",              sku: 'LOAC-003', price: 155, category: 'Biscuits' },
    { item_id: 10031, model_id: 0, name: "Pedigree Adult Dry Dog Food 3kg",          sku: 'PEDI-001', price: 399, category: 'Pet Food' },
    { item_id: 10032, model_id: 0, name: "Pedigree Puppy Dry Dog Food 1.5kg",        sku: 'PEDI-002', price: 249, category: 'Pet Food' },
    { item_id: 10033, model_id: 0, name: "Pedigree Wet Dog Food Beef 130g",          sku: 'PEDI-003', price: 49,  category: 'Pet Food' },
    { item_id: 10034, model_id: 0, name: "Pedigree DentaStix Daily Oral Care 7s",   sku: 'PEDI-004', price: 89,  category: 'Pet Food' },
    { item_id: 10035, model_id: 0, name: "Ferrero Rocher 3pcs Box",                  sku: 'FERR-001', price: 89,  category: 'Candy' },
    { item_id: 10036, model_id: 0, name: "Ferrero Rocher 16pcs Box 200g",            sku: 'FERR-002', price: 349, category: 'Candy' },
    { item_id: 10037, model_id: 0, name: "Ferrero Rocher 24pcs Box 300g",            sku: 'FERR-003', price: 499, category: 'Candy' },
    { item_id: 10038, model_id: 0, name: "Swiss Miss Hot Cocoa Mix 28g Sachet",      sku: 'SWMS-001', price: 35,  category: 'Drinks' },
    { item_id: 10039, model_id: 0, name: "Swiss Miss Milk Chocolate Mix 10s",        sku: 'SWMS-002', price: 299, category: 'Drinks' },
    { item_id: 10040, model_id: 0, name: "Swiss Miss Dark Chocolate Mix 10s",        sku: 'SWMS-003', price: 299, category: 'Drinks' },
    { item_id: 10041, model_id: 0, name: "Dole Pineapple Juice 240ml Can",           sku: 'DOLE-001', price: 45,  category: 'Drinks' },
    { item_id: 10042, model_id: 0, name: "Dole Pineapple Chunks in Juice 227g",      sku: 'DOLE-002', price: 65,  category: 'Canned' },
    { item_id: 10043, model_id: 0, name: "Dole Tropical Fruit Salad 227g",           sku: 'DOLE-003', price: 75,  category: 'Canned' },
    { item_id: 10044, model_id: 0, name: "Dole Crushed Pineapple 227g",              sku: 'DOLE-004', price: 65,  category: 'Canned' },
    { item_id: 10045, model_id: 0, name: "Reynolds Wrap Aluminum Foil 37.2 sqft",   sku: 'REYN-001', price: 189, category: 'Kitchen' },
    { item_id: 10046, model_id: 0, name: "Reynolds Wrap Heavy Duty Foil 50 sqft",   sku: 'REYN-002', price: 249, category: 'Kitchen' },
    { item_id: 10047, model_id: 0, name: "Reynolds Kitchens Parchment Paper 30sqft", sku: 'REYN-003', price: 169, category: 'Kitchen' },
    { item_id: 10048, model_id: 0, name: "Reynolds Oven Bags Turkey Size 2s",        sku: 'REYN-004', price: 129, category: 'Kitchen' },
    { item_id: 10049, model_id: 0, name: "Reynolds Wrap Non-Stick Foil 35 sqft",    sku: 'REYN-005', price: 219, category: 'Kitchen' },
    { item_id: 10050, model_id: 0, name: "Reynolds Cut-Rite Wax Paper 75 sqft",     sku: 'REYN-006', price: 159, category: 'Kitchen' },
  ],

  syncedProducts: {},

  orders: [
    {
      order_sn: 'SPX20260521001', order_status: 'READY_TO_SHIP',
      fulfillment_flag: 'fulfilled_by_local_seller',
      create_time: ts() - 3600, update_time: ts() - 60,
      buyer_user_id: 1001, buyer_username: 'juan_delacruz',
      shipping_carrier: 'SPX Express', currency: 'PHP', total_amount: 515,
      estimated_shipping_fee: 0, actual_shipping_fee: 0, actual_shipping_fee_confirmed: false,
      tracking_no: '',
      package_list: [{ package_number: '', logistics_status: 'LOGISTICS_REQUEST_CREATED', shipping_carrier: 'SPX Express', item_list: [] }],
      recipient_address: { name: 'Juan Dela Cruz', phone: '+639171234567', full_address: '123 Rizal Street, Barangay San Antonio, Makati, Metro Manila, 1200, PH', city: 'Makati', state: 'Metro Manila', region: 'PH', zipcode: '1200' },
      item_list: [
        { item_id: 10001, model_id: 0, item_name: "Lay's Classic Salted Chips 60g", item_sku: 'LAYS-001', model_sku: 'LAYS-001', model_quantity_purchased: 3, model_original_price: 62,  model_discounted_price: 62  },
        { item_id: 10008, model_id: 0, item_name: "Doritos Nacho Cheese 100g",       item_sku: 'DORI-001', model_sku: 'DORI-001', model_quantity_purchased: 2, model_original_price: 75,  model_discounted_price: 75  },
        { item_id: 10015, model_id: 0, item_name: "M&M's Milk Chocolate 100g",       item_sku: 'MNMS-001', model_sku: 'MNMS-001', model_quantity_purchased: 1, model_original_price: 129, model_discounted_price: 129 },
      ],
    },
    {
      order_sn: 'SPX20260521002', order_status: 'READY_TO_SHIP',
      fulfillment_flag: 'fulfilled_by_local_seller',
      create_time: ts() - 86400, update_time: ts() - 60,
      buyer_user_id: 1002, buyer_username: 'maria_santos',
      shipping_carrier: 'SPX Express', currency: 'PHP', total_amount: 874,
      estimated_shipping_fee: 0, actual_shipping_fee: 0, actual_shipping_fee_confirmed: false,
      tracking_no: '',
      package_list: [{ package_number: '', logistics_status: 'LOGISTICS_REQUEST_CREATED', shipping_carrier: 'SPX Express', item_list: [] }],
      recipient_address: { name: 'Maria Santos', phone: '+639289876543', full_address: '456 Bonifacio Avenue, Barangay Poblacion, Cebu City, Cebu, 6000, PH', city: 'Cebu City', state: 'Cebu', region: 'PH', zipcode: '6000' },
      item_list: [
        { item_id: 10021, model_id: 0, item_name: "Nutella Hazelnut Spread 350g", item_sku: 'NUTE-001', model_sku: 'NUTE-001', model_quantity_purchased: 2, model_original_price: 259, model_discounted_price: 259 },
        { item_id: 10035, model_id: 0, item_name: "Ferrero Rocher 3pcs Box",      item_sku: 'FERR-001', model_sku: 'FERR-001', model_quantity_purchased: 4, model_original_price: 89,  model_discounted_price: 89  },
      ],
    },
    {
      order_sn: 'SPX20260521003', order_status: 'READY_TO_SHIP',
      fulfillment_flag: 'fulfilled_by_local_seller',
      create_time: ts() - 7200, update_time: ts() - 60,
      buyer_user_id: 1003, buyer_username: 'jose_reyes',
      shipping_carrier: 'J&T Express', currency: 'PHP', total_amount: 337,
      estimated_shipping_fee: 0, actual_shipping_fee: 0, actual_shipping_fee_confirmed: false,
      tracking_no: '',
      package_list: [{ package_number: '', logistics_status: 'LOGISTICS_REQUEST_CREATED', shipping_carrier: 'J&T Express', item_list: [] }],
      recipient_address: { name: 'Jose Reyes', phone: '+639351112222', full_address: '789 Quezon Boulevard, Barangay Malate, Davao City, Davao del Sur, 8000, PH', city: 'Davao City', state: 'Davao del Sur', region: 'PH', zipcode: '8000' },
      item_list: [
        { item_id: 10011, model_id: 0, item_name: "Quaker Oats 800g",    item_sku: 'QKRO-001', model_sku: 'QKRO-001', model_quantity_purchased: 1, model_original_price: 149, model_discounted_price: 149 },
        { item_id: 10005, model_id: 0, item_name: "Cheetos Crunchy 80g", item_sku: 'CHTO-001', model_sku: 'CHTO-001', model_quantity_purchased: 2, model_original_price: 62,  model_discounted_price: 62  },
        { item_id: 10024, model_id: 0, item_name: "Tic Tac Orange 16g",  item_sku: 'TICT-001', model_sku: 'TICT-001', model_quantity_purchased: 3, model_original_price: 25,  model_discounted_price: 25  },
      ],
    },
  ],

  labelStatus:     {},
  trackingNumbers: {},
  deliveryStatus:  {},
};

let orderCounter = 4;

// ─────────────────────────────────────────────────────────────────────
//  TRACKING PAGE
// ─────────────────────────────────────────────────────────────────────
app.get('/track/:tracking', (req, res) => {
  const { tracking } = req.params;
  const order = DB.orders.find(o =>
    o.tracking_no === tracking || DB.trackingNumbers[o.order_sn] === tracking
  );
  const currentStep = order
    ? (DB.deliveryStatus[order.order_sn] ?? (order.order_status === 'SHIPPED' ? 1 : 0))
    : 1;

  const stepTimes = DELIVERY_STEPS.map((_, i) => {
    if (!order || i > currentStep) return '';
    const baseTime = order.update_time || ts();
    const secsAgo  = (currentStep - i) * 7200;
    return new Date((baseTime - secsAgo) * 1000).toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
  });

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Track Shipment — ${tracking}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.card{background:white;border-radius:16px;max-width:480px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden}
.header{background:#EE4D2D;padding:20px 24px;color:white}
.header .logo{font-size:20px;font-weight:900;margin-bottom:4px}
.header .sub{font-size:12px;opacity:.8}
.tracking-no{font-size:22px;font-weight:700;letter-spacing:2px;margin-top:8px}
.body{padding:24px}
.info-row{display:flex;justify-content:space-between;margin-bottom:12px;font-size:13px}
.info-row .label{color:#888}
.info-row .value{font-weight:600}
.divider{border:none;border-top:1px solid #f0f0f0;margin:16px 0}
.step{display:flex;align-items:flex-start;gap:14px;margin-bottom:4px}
.step-icon{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;margin-top:2px}
.step-icon.done{background:#EE4D2D;color:white}
.step-icon.active{background:#EE4D2D;color:white;box-shadow:0 0 0 4px rgba(238,77,45,.2)}
.step-icon.pending{background:#f0f0f0;color:#bbb}
.step-label{font-size:13px;font-weight:600}
.step-label.pending{color:#bbb}
.step-time{font-size:11px;color:#888;margin-top:2px}
.step-connector{width:2px;height:20px;margin-left:13px;background:#f0f0f0;margin-bottom:4px}
.step-connector.done{background:#EE4D2D}
.delivered-banner{background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:12px 14px;margin-top:16px;text-align:center;font-size:13px;font-weight:600;color:#15803d}
.mock-badge{background:#fffbeb;border-top:1px solid #fcd34d;text-align:center;padding:10px;font-size:11px;color:#92400e}
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <div class="logo">Shopee Express</div>
    <div class="sub">Shipment Tracking</div>
    <div class="tracking-no">${tracking}</div>
  </div>
  <div class="body">
    ${order ? `
    <div class="info-row"><span class="label">Order</span><span class="value">${order.order_sn}</span></div>
    <div class="info-row"><span class="label">Carrier</span><span class="value">${order.shipping_carrier}</span></div>
    <div class="info-row"><span class="label">Recipient</span><span class="value">${order.recipient_address.name}</span></div>
    <div class="info-row"><span class="label">Destination</span><span class="value">${order.recipient_address.city}, ${order.recipient_address.state}</span></div>
    <hr class="divider">
    <div>
      ${DELIVERY_STEPS.map((stepName, i) => {
        const isDone = i < currentStep, isActive = i === currentStep;
        const cls  = isDone ? 'done' : isActive ? 'active' : 'pending';
        const icon = isDone ? '✓' : isActive ? '●' : '○';
        return `${i > 0 ? `<div class="step-connector ${i <= currentStep ? 'done' : ''}"></div>` : ''}
          <div class="step">
            <div class="step-icon ${cls}">${icon}</div>
            <div>
              <div class="step-label ${!isDone && !isActive ? 'pending' : ''}">${stepName}</div>
              ${stepTimes[i] ? `<div class="step-time">${stepTimes[i]}</div>` : ''}
            </div>
          </div>`;
      }).join('')}
    </div>
    ${currentStep === 4 ? `<div class="delivered-banner">✅ Package delivered successfully!</div>` : ''}
    ` : `<p style="color:#888;text-align:center;padding:20px">Tracking number not found.<br><br><strong>${tracking}</strong></p>`}
  </div>
  <div class="mock-badge">🟠 Shopee Mock API — Demo tracking page</div>
</div>
</body></html>`);
});

// ─────────────────────────────────────────────────────────────────────
//  ROOT — Shopee Seller Center UI
// ─────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  const synced   = Object.values(DB.syncedProducts).sort((a, b) => a.sku.localeCompare(b.sku));
  const self     = `${req.protocol}://${req.get('host')}`;
  const tab      = req.query.tab || 'orders';

  // ── build order rows ──
  const orderRows = DB.orders.map(o => {
    const tracking   = DB.trackingNumbers[o.order_sn] || '';
    const delivStep  = DB.deliveryStatus[o.order_sn];
    const isShipped  = o.order_status === 'SHIPPED';
    const isDelivered = delivStep === 4;
    const statusLabel = isDelivered ? 'COMPLETED' : o.order_status === 'READY_TO_SHIP' ? 'To Ship' : isShipped ? 'Shipping' : o.order_status;
    const statusCls   = isDelivered ? 'completed' : o.order_status === 'READY_TO_SHIP' ? 'toship' : isShipped ? 'shipping' : 'default';
    const items       = o.item_list.map(i => `${i.item_name} x${i.model_quantity_purchased}`).join('; ');
    const itemCount   = o.item_list.reduce((s, i) => s + i.model_quantity_purchased, 0);
    const createDate  = new Date(o.create_time * 1000).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });

    let actionBtn = '';
    if (!isShipped) {
      actionBtn = `<button class="sc-btn sc-btn-primary" onclick="shipOrder('${o.order_sn}')">Arrange Shipment</button>`;
    } else if (!isDelivered) {
      const nextStep  = (delivStep ?? 1) + 1;
      const nextLabel = DELIVERY_STEPS[nextStep] || 'Delivered';
      actionBtn = `
        <button class="sc-btn sc-btn-outline" onclick="advanceDelivery('${o.order_sn}')" title="Advance to: ${nextLabel}">→ ${nextLabel}</button>
        <button class="sc-btn sc-btn-outline" onclick="printLabel('${o.order_sn}')" style="margin-top:4px">Print Label</button>`;
    } else {
      actionBtn = `<span class="sc-completed-tag">Completed</span>`;
    }

    return `<tr>
      <td>
        <div class="sc-order-id">${o.order_sn}</div>
        <div class="sc-order-date">${createDate}</div>
      </td>
      <td>
        <div class="sc-product-name">${o.item_list[0].item_name}${o.item_list.length > 1 ? ` <span class="sc-more">+${o.item_list.length - 1} more</span>` : ''}</div>
        <div class="sc-product-meta">${itemCount} item${itemCount > 1 ? 's' : ''} · ${o.shipping_carrier}</div>
      </td>
      <td><div class="sc-buyer">${o.recipient_address.name}</div><div class="sc-buyer-city">${o.recipient_address.city}</div></td>
      <td class="sc-amount">&#8369;${o.total_amount.toLocaleString()}</td>
      <td><span class="sc-status ${statusCls}">${statusLabel}</span></td>
      <td class="sc-tracking">
        ${tracking ? `<a href="/track/${tracking}" target="_blank" class="sc-track-link">${tracking}</a>` : '<span class="sc-no-tracking">—</span>'}
      </td>
      <td class="sc-actions">${actionBtn}</td>
    </tr>`;
  }).join('');

  // ── count tabs ──
  const toShipCount  = DB.orders.filter(o => o.order_status === 'READY_TO_SHIP').length;
  const shippingCount = DB.orders.filter(o => o.order_status === 'SHIPPED' && (DB.deliveryStatus[o.order_sn] ?? 0) < 4).length;
  const completedCount = DB.orders.filter(o => DB.deliveryStatus[o.order_sn] === 4).length;

  // ── build product rows ──
  const productRows = DB.products.map(p => {
    const synced = DB.syncedProducts[p.item_id];
    const stock  = synced ? synced.stock : 100;
    const stockDisplay = stock === 0 ? `<span class="sc-sold-out">Sold out</span>` : `<span class="sc-stock ${stock <= 10 ? 'low' : ''}">${stock}</span>`;
    const lastSync = synced ? `<span class="sc-synced-tag">Odoo</span><span class="sc-sync-time">${synced.last_sync}</span>` : '<span class="sc-no-sync">—</span>';
    return `<tr>
      <td>
        <div class="sc-prod-wrap">
          <div class="sc-prod-thumb" style="background:linear-gradient(135deg,#EE4D2D22,#EE4D2D11);border:1px solid #EE4D2D22">
            <span style="font-size:9px;font-weight:700;color:#EE4D2D">${p.sku.split('-')[0]}</span>
          </div>
          <div>
            <div class="sc-prod-name">${p.name}</div>
            <div class="sc-prod-ids">Item ID: ${p.item_id} · SKU: ${p.sku}</div>
          </div>
        </div>
      </td>
      <td class="sc-price">&#8369;${p.price}</td>
      <td>${stockDisplay}</td>
      <td class="sc-sales">—</td>
      <td>${lastSync}</td>
      <td class="sc-actions">
        <span class="sc-action-link">Edit</span>
        <span class="sc-action-link">Boost</span>
      </td>
    </tr>`;
  }).join('');

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Shopee Seller Centre</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;color:#222;font-size:13px;min-height:100vh}

/* ── Topbar ── */
.sc-topbar{background:#EE4D2D;display:flex;align-items:center;height:48px;padding:0 16px;gap:12px;position:sticky;top:0;z-index:100}
.sc-topbar-logo{display:flex;align-items:center;gap:8px;color:white;font-size:18px;font-weight:700;text-decoration:none;padding-right:16px;border-right:1px solid rgba(255,255,255,0.3)}
.sc-topbar-logo-s{width:28px;height:28px;background:white;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#EE4D2D;font-size:16px;font-weight:900}
.sc-topbar-title{color:white;font-size:13px;opacity:.85}
.sc-topbar-shop{margin-left:auto;display:flex;align-items:center;gap:6px;color:white;font-size:12px;opacity:.9}
.sc-online-dot{width:7px;height:7px;border-radius:50%;background:#4ade80;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}

/* ── Layout ── */
.sc-layout{display:flex;min-height:calc(100vh - 48px)}

/* ── Sidebar ── */
.sc-sidebar{width:200px;background:white;border-right:1px solid #e8e8e8;padding:8px 0;flex-shrink:0}
.sc-sidebar-section{padding:16px 16px 4px;font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.6px}
.sc-sidebar-item{display:flex;align-items:center;gap:8px;padding:8px 16px;cursor:pointer;color:#444;font-size:13px;transition:background .1s;border-left:3px solid transparent}
.sc-sidebar-item:hover{background:#fff5f3;color:#EE4D2D}
.sc-sidebar-item.active{background:#fff5f3;color:#EE4D2D;font-weight:600;border-left-color:#EE4D2D}
.sc-sidebar-sub{padding:6px 16px 6px 28px;cursor:pointer;color:#555;font-size:12px;transition:background .1s}
.sc-sidebar-sub:hover{background:#fff5f3;color:#EE4D2D}
.sc-sidebar-sub.active{color:#EE4D2D;font-weight:600}

/* ── Main ── */
.sc-main{flex:1;padding:16px;overflow:auto}

/* ── Page header ── */
.sc-page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.sc-page-title{font-size:18px;font-weight:600;color:#222}
.sc-breadcrumb{font-size:12px;color:#888;margin-bottom:4px}
.sc-breadcrumb span{color:#EE4D2D}

/* ── Tabs ── */
.sc-tabs{display:flex;border-bottom:2px solid #e8e8e8;margin-bottom:14px;gap:0}
.sc-tab{padding:10px 18px;font-size:13px;cursor:pointer;color:#555;border-bottom:2px solid transparent;margin-bottom:-2px;white-space:nowrap;transition:color .15s}
.sc-tab:hover{color:#EE4D2D}
.sc-tab.active{color:#EE4D2D;font-weight:600;border-bottom-color:#EE4D2D}
.sc-tab .sc-tab-count{display:inline-block;background:#EE4D2D;color:white;font-size:10px;font-weight:700;padding:1px 6px;border-radius:10px;margin-left:5px}

/* ── Toolbar ── */
.sc-toolbar{display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap}
.sc-search{display:flex;align-items:center;border:1px solid #ddd;border-radius:4px;overflow:hidden;background:white}
.sc-search input{border:none;outline:none;padding:6px 10px;font-size:12px;width:200px}
.sc-search-btn{background:#EE4D2D;color:white;border:none;padding:6px 12px;cursor:pointer;font-size:12px}
.sc-filter-select{padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:12px;background:white;color:#444}
.sc-btn{display:inline-block;padding:6px 14px;border-radius:4px;font-size:12px;cursor:pointer;font-weight:500;border:none;transition:all .15s;white-space:nowrap}
.sc-btn-primary{background:#EE4D2D;color:white}.sc-btn-primary:hover{background:#d94426}
.sc-btn-outline{background:white;color:#555;border:1px solid #ddd}.sc-btn-outline:hover{border-color:#EE4D2D;color:#EE4D2D}
.sc-btn-sm{padding:4px 10px;font-size:11px}

/* ── Table ── */
.sc-table-wrap{background:white;border-radius:4px;border:1px solid #e8e8e8;overflow:hidden}
table{width:100%;border-collapse:collapse}
th{padding:10px 12px;font-size:11px;font-weight:600;color:#666;text-align:left;background:#fafafa;border-bottom:1px solid #e8e8e8;white-space:nowrap}
td{padding:12px 12px;border-bottom:1px solid #f2f2f2;vertical-align:top}
tr:last-child td{border-bottom:none}
tr:hover td{background:#fffaf9}

/* ── Order cells ── */
.sc-order-id{font-size:12px;font-weight:600;color:#EE4D2D;font-family:monospace}
.sc-order-date{font-size:11px;color:#999;margin-top:2px}
.sc-product-name{font-size:12px;font-weight:500;color:#222;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sc-product-meta{font-size:11px;color:#999;margin-top:2px}
.sc-more{background:#f0f0f0;color:#666;font-size:10px;padding:1px 5px;border-radius:3px}
.sc-buyer{font-size:12px;font-weight:500}
.sc-buyer-city{font-size:11px;color:#999;margin-top:1px}
.sc-amount{font-size:13px;font-weight:600;color:#222;white-space:nowrap}
.sc-tracking{font-size:11px}
.sc-track-link{color:#EE4D2D;text-decoration:none;font-family:monospace;font-size:11px}.sc-track-link:hover{text-decoration:underline}
.sc-no-tracking{color:#bbb}
.sc-actions{white-space:nowrap}
.sc-actions .sc-btn{display:block;width:100%;margin-bottom:4px;text-align:center}
.sc-completed-tag{font-size:11px;color:#16a34a;font-weight:600}

/* ── Status badges ── */
.sc-status{display:inline-block;padding:3px 8px;border-radius:3px;font-size:11px;font-weight:600;white-space:nowrap}
.sc-status.toship{background:#FFF3E0;color:#E65100}
.sc-status.shipping{background:#E3F2FD;color:#1565C0}
.sc-status.completed{background:#E8F5E9;color:#2E7D32}
.sc-status.default{background:#f5f5f5;color:#666}

/* ── Product cells ── */
.sc-prod-wrap{display:flex;align-items:center;gap:8px}
.sc-prod-thumb{width:40px;height:40px;border-radius:4px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.sc-prod-name{font-size:12px;font-weight:500;color:#222;max-width:260px;line-height:1.4}
.sc-prod-ids{font-size:10px;color:#999;margin-top:2px}
.sc-price{font-size:13px;font-weight:600;white-space:nowrap}
.sc-stock{font-size:13px;font-weight:500;color:#222}
.sc-stock.low{color:#E65100;font-weight:700}
.sc-sold-out{font-size:12px;color:#EE4D2D;font-weight:600}
.sc-sales{color:#999;font-size:12px}
.sc-synced-tag{display:inline-block;background:#E3F2FD;color:#1565C0;font-size:10px;font-weight:600;padding:1px 6px;border-radius:10px;margin-right:4px}
.sc-sync-time{font-size:10px;color:#999}
.sc-no-sync{color:#bbb}
.sc-action-link{color:#1a6ef5;font-size:12px;cursor:pointer;margin-right:8px}.sc-action-link:hover{text-decoration:underline}

/* ── Info boxes ── */
.sc-info-box{background:#fff8e6;border:1px solid #ffd369;border-radius:4px;padding:10px 14px;font-size:12px;color:#7a5c00;margin-bottom:12px;display:flex;align-items:flex-start;gap:8px}
.sc-warn-box{background:#fff1f1;border:1px solid #ffb3b3;border-radius:4px;padding:10px 14px;font-size:12px;color:#a00;margin-bottom:12px}
.sc-mock-bar{background:#fff3cd;border-top:1px solid #ffc107;padding:7px 16px;font-size:11px;color:#856404;text-align:center}

/* ── Summary cards ── */
.sc-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
@media(max-width:640px){.sc-summary{grid-template-columns:repeat(2,1fr)}}
.sc-card{background:white;border:1px solid #e8e8e8;border-radius:4px;padding:12px 14px}
.sc-card-label{font-size:11px;color:#888;margin-bottom:4px}
.sc-card-value{font-size:22px;font-weight:600;color:#222}
.sc-card-value.orange{color:#EE4D2D}
.sc-card-value.green{color:#16a34a}

/* ── New order form ── */
.sc-new-order{background:#fafafa;border:1px solid #e8e8e8;border-radius:4px;padding:14px;margin-bottom:12px;display:none}
.sc-new-order h3{font-size:13px;font-weight:600;margin-bottom:10px;color:#222}
.sc-form-row{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end}
.sc-form-group{display:flex;flex-direction:column;gap:3px}
.sc-form-group label{font-size:11px;color:#666}
.sc-form-group input,.sc-form-group select{padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:12px;min-width:120px}

/* ── Toast ── */
.sc-toast{position:fixed;bottom:24px;right:24px;background:#333;color:white;padding:10px 18px;border-radius:6px;font-size:12px;font-weight:500;opacity:0;transition:opacity .25s;z-index:9999;max-width:300px}
.sc-toast.show{opacity:1}

/* ── Shipping priority tabs ── */
.sc-priority-tabs{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap}
.sc-priority-tab{padding:5px 14px;border-radius:20px;border:1px solid #ddd;font-size:12px;cursor:pointer;color:#555;background:white}
.sc-priority-tab.active{background:#EE4D2D;color:white;border-color:#EE4D2D}
.sc-priority-tab:hover:not(.active){border-color:#EE4D2D;color:#EE4D2D}
</style>
</head>
<body>

<!-- Topbar -->
<div class="sc-topbar">
  <a class="sc-topbar-logo" href="/">
    <div class="sc-topbar-logo-s">S</div>
    <span>Seller Centre</span>
  </a>
  <span class="sc-topbar-title">Mock API Demo</span>
  <div class="sc-topbar-shop">
    <span class="sc-online-dot"></span>
    ${DB.shop.shop_name} · ID: ${DB.shop.shop_id}
  </div>
</div>

<div class="sc-layout">
<!-- Sidebar -->
<div class="sc-sidebar">
  <div class="sc-sidebar-section">Order</div>
  <div class="sc-sidebar-item ${tab === 'orders' ? 'active' : ''}" onclick="switchTab('orders')">My Orders</div>
  <div class="sc-sidebar-sub">Mass Ship</div>
  <div class="sc-sidebar-sub">Handover Centre</div>
  <div class="sc-sidebar-sub">Return/Refund/Cancel</div>

  <div class="sc-sidebar-section">Product</div>
  <div class="sc-sidebar-item ${tab === 'products' ? 'active' : ''}" onclick="switchTab('products')">My Products</div>
  <div class="sc-sidebar-sub">Add New Product</div>

  <div class="sc-sidebar-section">FBS</div>
  <div class="sc-sidebar-sub">Fulfilled by Shopee</div>

  <div class="sc-sidebar-section">Finance</div>
  <div class="sc-sidebar-sub">My Income</div>
  <div class="sc-sidebar-sub">My Balance</div>

  <div class="sc-sidebar-section">Data</div>
  <div class="sc-sidebar-sub">Business Insights</div>
  <div class="sc-sidebar-sub">Account Health</div>
</div>

<!-- Main -->
<div class="sc-main">

${!ODOO_BASE_URL ? `<div class="sc-warn-box">⚠️ <strong>ODOO_BASE_URL</strong> not set — OAuth callback and webhook delivery notifications are disabled.</div>` : ''}

<!-- ══════════ ORDERS TAB ══════════ -->
<div id="tab-orders" style="display:${tab === 'orders' ? 'block' : 'none'}">
  <div class="sc-breadcrumb">Home > <span>My Orders</span></div>
  <div class="sc-page-header">
    <div class="sc-page-title">My Orders</div>
    <div style="display:flex;gap:8px">
      <button class="sc-btn sc-btn-outline">Export</button>
      <button class="sc-btn sc-btn-outline">Export History</button>
    </div>
  </div>

  <div class="sc-summary">
    <div class="sc-card"><div class="sc-card-label">Total Orders</div><div class="sc-card-value orange">${DB.orders.length}</div></div>
    <div class="sc-card"><div class="sc-card-label">To Ship</div><div class="sc-card-value orange">${toShipCount}</div></div>
    <div class="sc-card"><div class="sc-card-label">Shipping</div><div class="sc-card-value">${shippingCount}</div></div>
    <div class="sc-card"><div class="sc-card-label">Completed</div><div class="sc-card-value green">${completedCount}</div></div>
  </div>

  <div class="sc-tabs">
    <div class="sc-tab active" onclick="filterOrders('all',this)">All</div>
    <div class="sc-tab" onclick="filterOrders('unpaid',this)">Unpaid</div>
    <div class="sc-tab" onclick="filterOrders('toship',this)">To Ship${toShipCount > 0 ? `<span class="sc-tab-count">${toShipCount}</span>` : ''}</div>
    <div class="sc-tab" onclick="filterOrders('shipping',this)">Shipping</div>
    <div class="sc-tab" onclick="filterOrders('completed',this)">Completed (${completedCount})</div>
    <div class="sc-tab" onclick="filterOrders('return',this)">Return/Refund/Cancel</div>
  </div>

  <div class="sc-info-box">
    ℹ️ <span>Tracking URL for Odoo: <code>${self}/track/</code> — set as tracking URL on SPX Express / J&T Express carrier in Odoo (Inventory → Configuration → Delivery Methods → append <code>{tracking_ref}</code>).</span>
  </div>

  <div class="sc-toolbar">
    <div class="sc-search">
      <input type="text" placeholder="Order ID, Buyer Name, Product Name" id="order-search-input">
      <button class="sc-search-btn" onclick="searchOrders()">Search</button>
    </div>
    <select class="sc-filter-select" id="channel-filter">
      <option>All Channels</option>
      <option>SPX Express</option>
      <option>J&T Express</option>
    </select>
    <button class="sc-btn sc-btn-primary" onclick="toggleNewOrderForm()">+ New Demo Order</button>
    <button class="sc-btn sc-btn-outline" onclick="location.reload()">↻ Refresh</button>
  </div>

  <!-- New order form -->
  <div class="sc-new-order" id="new-order-form">
    <h3>Create New Demo Order</h3>
    <div class="sc-form-row">
      <div class="sc-form-group"><label>Customer Name</label><input id="nof-name" type="text" value="Pedro Santos"></div>
      <div class="sc-form-group"><label>Phone</label><input id="nof-phone" type="text" value="+639171112233"></div>
      <div class="sc-form-group"><label>City</label><input id="nof-city" type="text" value="Manila"></div>
      <div class="sc-form-group"><label>Carrier</label>
        <select id="nof-carrier"><option>SPX Express</option><option>J&T Express</option><option>LBC Express</option></select>
      </div>
      <div class="sc-form-group"><label>Product</label>
        <select id="nof-product" style="min-width:220px">
          ${DB.products.map(p => `<option value="${p.item_id}" data-sku="${p.sku}" data-name="${p.name.replace(/"/g,'&quot;')}" data-price="${p.price}">${p.sku} — ${p.name}</option>`).join('')}
        </select>
      </div>
      <div class="sc-form-group"><label>Qty</label><input id="nof-qty" type="number" value="1" min="1" style="width:60px"></div>
      <div class="sc-form-group"><label>Price (PHP)</label><input id="nof-price" type="number" value="100" min="1" style="width:90px"></div>
      <div class="sc-form-group" style="justify-content:flex-end">
        <div style="display:flex;gap:6px">
          <button class="sc-btn sc-btn-primary" onclick="submitNewOrder()">Create</button>
          <button class="sc-btn sc-btn-outline" onclick="document.getElementById('new-order-form').style.display='none'">Cancel</button>
        </div>
      </div>
    </div>
  </div>

  <div class="sc-table-wrap">
    <table>
      <thead><tr>
        <th><input type="checkbox"></th>
        <th>Order ID / Date</th>
        <th>Product(s)</th>
        <th>Buyer</th>
        <th>Total Buyer Payment</th>
        <th>Status</th>
        <th>Tracking No.</th>
        <th>Actions</th>
      </tr></thead>
      <tbody id="orders-tbody">
        ${DB.orders.map(o => {
          const tracking   = DB.trackingNumbers[o.order_sn] || '';
          const delivStep  = DB.deliveryStatus[o.order_sn];
          const isShipped  = o.order_status === 'SHIPPED';
          const isDelivered = delivStep === 4;
          const statusLabel = isDelivered ? 'COMPLETED' : o.order_status === 'READY_TO_SHIP' ? 'To Ship' : isShipped ? 'Shipping' : o.order_status;
          const statusCls   = isDelivered ? 'completed' : o.order_status === 'READY_TO_SHIP' ? 'toship' : isShipped ? 'shipping' : 'default';
          const itemCount   = o.item_list.reduce((s, i) => s + i.model_quantity_purchased, 0);
          const createDate  = new Date(o.create_time * 1000).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });

          let actionBtn = '';
          if (!isShipped) {
            actionBtn = `<button class="sc-btn sc-btn-primary sc-btn-sm" onclick="shipOrder('${o.order_sn}')">Arrange Shipment</button>`;
          } else if (!isDelivered) {
            const nextStep  = (delivStep ?? 1) + 1;
            const nextLabel = DELIVERY_STEPS[nextStep] || 'Delivered';
            actionBtn = `<button class="sc-btn sc-btn-outline sc-btn-sm" onclick="advanceDelivery('${o.order_sn}')">→ ${nextLabel}</button>
              <button class="sc-btn sc-btn-outline sc-btn-sm" onclick="printLabel('${o.order_sn}')" style="margin-top:4px">Print Label</button>`;
          } else {
            actionBtn = `<span class="sc-completed-tag">✓ Done</span>`;
          }

          return `<tr>
            <td><input type="checkbox"></td>
            <td>
              <div class="sc-order-id">${o.order_sn}</div>
              <div class="sc-order-date">${createDate}</div>
            </td>
            <td>
              <div class="sc-product-name">${o.item_list[0].item_name}${o.item_list.length > 1 ? ` <span class="sc-more">+${o.item_list.length - 1}</span>` : ''}</div>
              <div class="sc-product-meta">${itemCount} item${itemCount > 1 ? 's' : ''} · ${o.shipping_carrier}</div>
            </td>
            <td><div class="sc-buyer">${o.recipient_address.name}</div><div class="sc-buyer-city">${o.recipient_address.city}</div></td>
            <td class="sc-amount">&#8369;${o.total_amount.toLocaleString()}</td>
            <td><span class="sc-status ${statusCls}">${statusLabel}</span></td>
            <td class="sc-tracking">${tracking ? `<a href="/track/${tracking}" target="_blank" class="sc-track-link">${tracking}</a>` : '<span class="sc-no-tracking">—</span>'}</td>
            <td class="sc-actions">${actionBtn}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    ${DB.orders.length === 0 ? `<div style="text-align:center;padding:40px;color:#bbb"><div style="font-size:40px;margin-bottom:8px">📋</div><div>No Orders Found</div><div style="font-size:11px;margin-top:4px;color:#EE4D2D;cursor:pointer" onclick="location.reload()">Please Reload</div></div>` : ''}
  </div>
</div>

<!-- ══════════ PRODUCTS TAB ══════════ -->
<div id="tab-products" style="display:${tab === 'products' ? 'block' : 'none'}">
  <div class="sc-breadcrumb">Home > <span>My Products</span></div>
  <div class="sc-page-header">
    <div class="sc-page-title">My Products</div>
    <div style="display:flex;gap:8px">
      <button class="sc-btn sc-btn-outline">Product Settings</button>
      <button class="sc-btn sc-btn-outline">Mass Function</button>
      <button class="sc-btn sc-btn-primary">+ Add a New Product</button>
    </div>
  </div>

  <div class="sc-summary">
    <div class="sc-card"><div class="sc-card-label">Total Products</div><div class="sc-card-value orange">${DB.products.length}</div></div>
    <div class="sc-card"><div class="sc-card-label">Synced from Odoo</div><div class="sc-card-value green">${Object.keys(DB.syncedProducts).length}</div></div>
    <div class="sc-card"><div class="sc-card-label">Out of Stock</div><div class="sc-card-value orange">${Object.values(DB.syncedProducts).filter(p => p.stock === 0).length}</div></div>
    <div class="sc-card"><div class="sc-card-label">Low Stock (≤10)</div><div class="sc-card-value">${Object.values(DB.syncedProducts).filter(p => p.stock > 0 && p.stock <= 10).length}</div></div>
  </div>

  <div class="sc-tabs">
    <div class="sc-tab active">All (${DB.products.length})</div>
    <div class="sc-tab">Restock (${Object.values(DB.syncedProducts).filter(p => p.stock <= 5).length})</div>
    <div class="sc-tab">To Review Listing Detail</div>
  </div>

  <div class="sc-toolbar">
    <div class="sc-search">
      <input type="text" placeholder="Search Product Name, Parent SKU, SKU, Item ID" id="product-search-input">
      <button class="sc-search-btn">Search</button>
    </div>
    <select class="sc-filter-select"><option>Category</option>${[...new Set(DB.products.map(p => p.category))].map(c => `<option>${c}</option>`).join('')}</select>
    <button class="sc-btn sc-btn-outline" onclick="location.reload()">↻ Refresh (sync from Odoo)</button>
  </div>

  <div class="sc-info-box">
    ℹ️ <span>Products are synced from Odoo via the <strong>Inventory Sync</strong> action. Stock levels shown here reflect Odoo's current inventory.</span>
  </div>

  <div class="sc-table-wrap">
    <table>
      <thead><tr>
        <th><input type="checkbox"></th>
        <th>Product(s)</th>
        <th>Price ↕</th>
        <th>Stock ↕</th>
        <th>Sales</th>
        <th>Odoo Sync</th>
        <th>Action</th>
      </tr></thead>
      <tbody>
        ${DB.products.map(p => {
          const synced = DB.syncedProducts[p.item_id];
          const stock  = synced ? synced.stock : 100;
          const stockDisplay = stock === 0 ? `<span class="sc-sold-out">Sold out</span>` : `<span class="sc-stock ${stock <= 10 ? 'low' : ''}">${stock}</span>`;
          const lastSync = synced ? `<span class="sc-synced-tag">Odoo</span><span class="sc-sync-time">${synced.last_sync}</span>` : '<span class="sc-no-sync">—</span>';
          return `<tr>
            <td><input type="checkbox"></td>
            <td>
              <div class="sc-prod-wrap">
                <div class="sc-prod-thumb" style="background:#fff0ed;border:1px solid #ffc4b3">
                  <span style="font-size:9px;font-weight:700;color:#EE4D2D">${p.sku.split('-')[0]}</span>
                </div>
                <div>
                  <div class="sc-prod-name">${p.name}</div>
                  <div class="sc-prod-ids">Item ID: ${p.item_id} &nbsp;·&nbsp; SKU: <strong>${p.sku}</strong></div>
                </div>
              </div>
            </td>
            <td class="sc-price">&#8369;${p.price}</td>
            <td>${stockDisplay}</td>
            <td class="sc-sales">—<div style="font-size:10px;color:#bbb">L30D: 0</div></td>
            <td>${lastSync}</td>
            <td>
              <span class="sc-action-link">Edit</span>
              <span class="sc-action-link">Boost</span>
              <span class="sc-action-link">More</span>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>
</div>

</div><!-- /.sc-main -->
</div><!-- /.sc-layout -->

<div class="sc-mock-bar">🟠 Shopee Mock API v4.0 — Demo environment · Partner ID: ${PARTNER_ID}</div>
<div class="sc-toast" id="sc-toast"></div>

<script>
const DELIVERY_STEPS = ${JSON.stringify(DELIVERY_STEPS)};

function switchTab(t) {
  document.getElementById('tab-orders').style.display   = t === 'orders'   ? 'block' : 'none';
  document.getElementById('tab-products').style.display = t === 'products' ? 'block' : 'none';
  document.querySelectorAll('.sc-sidebar-item').forEach(el => el.classList.remove('active'));
  event.target.classList.add('active');
}

function filterOrders(type, el) {
  document.querySelectorAll('#tab-orders .sc-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}

function searchOrders() {}

function toast(msg, dur=3500) {
  const el = document.getElementById('sc-toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), dur);
}

function toggleNewOrderForm() {
  const f = document.getElementById('new-order-form');
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
  // auto-fill price from product
  const sel = document.getElementById('nof-product');
  if (sel) document.getElementById('nof-price').value = sel.selectedOptions[0].dataset.price || 100;
}

document.addEventListener('DOMContentLoaded', () => {
  const sel = document.getElementById('nof-product');
  if (sel) sel.addEventListener('change', () => {
    document.getElementById('nof-price').value = sel.selectedOptions[0].dataset.price || 100;
  });
});

function submitNewOrder() {
  const name  = document.getElementById('nof-name').value.trim();
  const phone = document.getElementById('nof-phone').value.trim();
  const city  = document.getElementById('nof-city').value.trim();
  const carrier = document.getElementById('nof-carrier').value;
  const sel   = document.getElementById('nof-product');
  const itemId = parseInt(sel.value);
  const sku    = sel.selectedOptions[0].dataset.sku;
  const pname  = sel.selectedOptions[0].dataset.name;
  const qty    = parseInt(document.getElementById('nof-qty').value) || 1;
  const price  = parseFloat(document.getElementById('nof-price').value) || 100;
  if (!name || !city) { toast('Please fill in customer name and city.'); return; }
  fetch('/api/demo/create_order', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phone, city, carrier, item_id: itemId, sku, item_name: pname, qty, price }),
  }).then(r => r.json()).then(d => {
    toast('✅ Order ' + d.order_sn + ' created');
    document.getElementById('new-order-form').style.display = 'none';
    setTimeout(() => location.reload(), 1500);
  }).catch(() => toast('❌ Failed to create order'));
}

function shipOrder(sn) {
  fetch('/api/demo/ship_order', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_sn: sn }),
  }).then(r => r.json()).then(d => {
    toast('🚚 ' + sn + ' shipped — tracking: ' + d.tracking_number);
    setTimeout(() => location.reload(), 1500);
  }).catch(() => toast('❌ Failed to ship order'));
}

function advanceDelivery(sn) {
  fetch('/api/demo/advance_delivery', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_sn: sn }),
  }).then(r => r.json()).then(d => {
    const stepName = DELIVERY_STEPS[d.step] || 'Unknown';
    toast(d.step === 4 ? '✅ ' + sn + ' delivered — Odoo notified!' : '📦 ' + sn + ' → ' + stepName, d.step === 4 ? 4500 : 3000);
    setTimeout(() => location.reload(), 1500);
  }).catch(() => toast('❌ Failed to advance delivery'));
}

function printLabel(sn) {
  window.open('/api/demo/print_label/' + sn, '_blank');
}
</script>
</body></html>`);
});

// ─────────────────────────────────────────────────────────────────────
//  DEMO — create / ship / advance order
// ─────────────────────────────────────────────────────────────────────
app.post('/api/demo/create_order', (req, res) => {
  const { name, phone, city, carrier, item_id, sku, item_name, qty, price } = req.body;
  orderCounter++;
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const sn    = `SPX${today}${String(orderCounter).padStart(3, '0')}`;
  const order = {
    order_sn: sn, order_status: 'READY_TO_SHIP',
    fulfillment_flag: 'fulfilled_by_local_seller',
    create_time: ts(), update_time: ts(),
    buyer_user_id: 1000 + orderCounter,
    buyer_username: name.toLowerCase().replace(/\s+/g, '_'),
    shipping_carrier: carrier || 'SPX Express',
    currency: 'PHP', total_amount: qty * price,
    estimated_shipping_fee: 0, actual_shipping_fee: 0, actual_shipping_fee_confirmed: false,
    tracking_no: '',
    package_list: [{ package_number: '', logistics_status: 'LOGISTICS_REQUEST_CREATED', shipping_carrier: carrier || 'SPX Express', item_list: [] }],
    recipient_address: {
      name, phone: phone || '+639000000000',
      full_address: `${Math.floor(Math.random() * 999) + 1} Demo Street, Barangay Central, ${city}, Metro Manila, 1000, PH`,
      city, state: 'Metro Manila', region: 'PH', zipcode: '1000',
    },
    item_list: [{
      item_id, model_id: 0, item_name, item_sku: sku, model_sku: sku,
      model_quantity_purchased: qty, model_original_price: price, model_discounted_price: price,
    }],
  };
  DB.orders.push(order);
  console.log(`[DEMO] New order: ${sn} for ${name}`);
  res.json({ order_sn: sn, message: 'Order created successfully' });
});

app.post('/api/demo/ship_order', (req, res) => {
  const { order_sn } = req.body;
  const order = DB.orders.find(o => o.order_sn === order_sn);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const tracking = 'PHSPX' + Date.now();
  order.order_status = 'SHIPPED';
  order.tracking_no  = tracking;
  order.update_time  = ts();
  DB.trackingNumbers[order_sn] = tracking;
  DB.labelStatus[order_sn]     = 'PROCESSING';
  DB.deliveryStatus[order_sn]  = 1;
  console.log(`[DEMO] ${order_sn} shipped — ${tracking}`);
  res.json({ order_sn, tracking_number: tracking, message: 'Order shipped successfully' });
});

app.post('/api/demo/advance_delivery', async (req, res) => {
  const { order_sn } = req.body;
  const order = DB.orders.find(o => o.order_sn === order_sn);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.order_status !== 'SHIPPED') return res.status(400).json({ error: 'Order must be SHIPPED first.' });
  const current = DB.deliveryStatus[order_sn] ?? 1;
  if (current >= 4) return res.json({ order_sn, step: 4, step_name: 'Delivered', message: 'Already delivered.' });
  const next = current + 1;
  DB.deliveryStatus[order_sn] = next;
  order.update_time = ts();
  console.log(`[DELIVERY] ${order_sn} → step ${next} (${DELIVERY_STEPS[next]})`);
  if (next === 4) {
    order.item_list.forEach(item => {
      const sp = DB.syncedProducts[item.item_id];
      if (sp) { sp.stock = Math.max(0, sp.stock - item.model_quantity_purchased); sp.last_sync = nowStr(); }
    });
    notifyOdooDelivered(order_sn).catch(e => console.warn('[WEBHOOK]', e.message));
  }
  res.json({ order_sn, step: next, step_name: DELIVERY_STEPS[next],
    message: next === 4 ? 'Delivered. Odoo webhook attempted.' : `Advanced to: ${DELIVERY_STEPS[next]}` });
});

// ─────────────────────────────────────────────────────────────────────
//  DEMO — print label (HTML, browser-friendly)
// ─────────────────────────────────────────────────────────────────────
app.get('/api/demo/print_label/:order_sn', (req, res) => {
  const { order_sn } = req.params;
  const order    = DB.orders.find(o => o.order_sn === order_sn);
  const tracking = DB.trackingNumbers[order_sn] || 'N/A';
  if (!order) return res.status(404).send('Order not found');
  if (DB.labelStatus[order_sn]) DB.labelStatus[order_sn] = 'STORED';
  const items = order.item_list.map(i =>
    `<tr><td>${i.item_name}</td><td style="text-align:center">${i.model_quantity_purchased}</td><td style="text-align:right">&#8369;${i.model_discounted_price}</td></tr>`
  ).join('');
  res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Label — ${order_sn}</title>
<style>
@media print{.no-print{display:none}body{margin:0}}
body{font-family:Arial,sans-serif;background:#f0f0f0;display:flex;justify-content:center;padding:20px}
.label{background:white;width:400px;border:2px solid #000;font-size:12px}
.lh{background:#EE4D2D;color:white;padding:10px 14px;display:flex;align-items:center;gap:10px}
.lh .logo{font-size:20px;font-weight:900;background:white;color:#EE4D2D;width:34px;height:34px;display:flex;align-items:center;justify-content:center;border-radius:6px}
.lh .title{font-size:13px;font-weight:700}.lh .sub{font-size:10px;opacity:.85}
.sec{padding:10px 14px;border-bottom:1px dashed #ccc}.sec:last-child{border-bottom:none}
.kv{display:flex;justify-content:space-between;margin-bottom:4px}
.k{color:#888;font-size:10px;text-transform:uppercase;letter-spacing:.5px}
.v{font-weight:700;font-size:13px}
.trk{background:#000;color:white;text-align:center;padding:10px;letter-spacing:3px;font-size:15px;font-weight:900;margin:8px 0;border-radius:4px}
.to{background:#fff8f6;border:1px solid #fde0d8;border-radius:6px;padding:8px 10px;margin-top:4px}
.toname{font-size:14px;font-weight:700;margin-bottom:2px}
.toaddr{font-size:11px;color:#555;line-height:1.5}
.it{width:100%;border-collapse:collapse;font-size:11px}
.it th{background:#f5f5f5;padding:5px 6px;text-align:left;font-size:10px;color:#888;text-transform:uppercase}
.it td{padding:5px 6px;border-bottom:1px solid #f0f0f0}
.bc{text-align:center;padding:8px;font-family:monospace;font-size:10px;letter-spacing:2px;color:#555}
.mock{background:#fffbeb;border-top:1px solid #fcd34d;text-align:center;padding:6px;font-size:10px;color:#92400e}
.pbtn{display:block;margin:16px auto;padding:10px 28px;background:#EE4D2D;color:white;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer}
</style></head><body>
<div>
<button class="pbtn no-print" onclick="window.print()">🖨 Print Label</button>
<div class="label">
  <div class="lh"><div class="logo">S</div><div><div class="title">Shopee Express</div><div class="sub">Shipping Label — Demo</div></div></div>
  <div class="sec">
    <div class="k">Order Number</div><div class="v">${order_sn}</div>
    <div class="trk">${tracking}</div>
    <div class="kv"><div><div class="k">Carrier</div><div style="font-weight:600">${order.shipping_carrier}</div></div><div style="text-align:right"><div class="k">Amount</div><div style="font-weight:600">&#8369;${order.total_amount}</div></div></div>
  </div>
  <div class="sec">
    <div class="k">Deliver To</div>
    <div class="to">
      <div class="toname">${order.recipient_address.name}</div>
      <div class="toaddr">${order.recipient_address.phone}<br>${order.recipient_address.full_address}</div>
    </div>
  </div>
  <div class="sec">
    <div class="k" style="margin-bottom:6px">Items</div>
    <table class="it"><thead><tr><th>Product</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th></tr></thead><tbody>${items}</tbody></table>
  </div>
  <div class="bc">||||| ${tracking} |||||\n${order_sn}</div>
  <div class="mock">🟠 Shopee Mock API — Demo only</div>
</div>
</div>
</body></html>`);
});

// ─────────────────────────────────────────────────────────────────────
//  AUTH routes
// ─────────────────────────────────────────────────────────────────────
app.get('/api/v2/shop/auth_partner', (req, res) => {
  const auth_url = buildAuthUrl(req);
  res.json({ error: '', message: '', request_id: rid(), response: { auth_url } });
});

app.get('/api/v2/auth/shop/get_auth_link', (req, res) => {
  const auth_url = buildAuthUrl(req);
  res.json({ error: '', message: '', request_id: rid(), response: { auth_url } });
});

app.get('/api/v2/auth/authorize', (req, res) => {
  const { redirect_url, shop_id, code } = req.query;
  const callbackUrl = redirect_url
    ? `${redirect_url}${redirect_url.includes('?') ? '&' : '?'}code=${code || 'MOCK_AUTH_CODE_2026'}&shop_id=${shop_id || DB.shop.shop_id}`
    : resolveOdooCallback(req, { code: code || 'MOCK_AUTH_CODE_2026', shop_id: shop_id || DB.shop.shop_id });
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Shopee — Authorize</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{background:white;border-radius:16px;padding:32px;max-width:400px;width:90%;box-shadow:0 4px 24px rgba(0,0,0,0.08);text-align:center}
.logo{width:56px;height:56px;background:#EE4D2D;border-radius:14px;display:flex;align-items:center;justify-content:center;color:white;font-size:26px;font-weight:700;margin:0 auto 16px}
h2{font-size:18px;margin-bottom:6px}.sub{font-size:13px;color:#888;margin-bottom:24px}
.shop-box{background:#fff8f6;border:1px solid #fde0d8;border-radius:10px;padding:14px;margin-bottom:24px;text-align:left}
.label{font-size:11px;color:#aaa;margin-bottom:2px}.value{font-size:13px;font-weight:600}
.perms{text-align:left;margin-bottom:24px}.perm{display:flex;align-items:center;gap:8px;font-size:12px;color:#555;padding:5px 0;border-bottom:1px solid #f5f5f5}
.perm:last-child{border-bottom:none}.pi{color:#16a34a}
.btn{display:block;width:100%;padding:13px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;border:none;transition:all .15s;margin-bottom:10px}
.bp{background:#EE4D2D;color:white}.bp:hover{background:#d94426}
.bs{background:#f5f5f5;color:#555}.bs:hover{background:#eee}
.mb{font-size:10px;color:#bbb;margin-top:16px}</style></head><body>
<div class="card">
  <div class="logo">S</div>
  <h2>Authorize App Access</h2>
  <p class="sub">An app is requesting access to your Shopee store</p>
  <div class="shop-box">
    <div class="label">Store</div><div class="value">${DB.shop.shop_name}</div>
    <div class="label" style="margin-top:8px">Shop ID</div><div class="value">${DB.shop.shop_id} · ${DB.shop.region}</div>
  </div>
  <div class="perms">
    <div class="perm"><span class="pi">✓</span> Read and manage products &amp; inventory</div>
    <div class="perm"><span class="pi">✓</span> Read and manage orders</div>
    <div class="perm"><span class="pi">✓</span> Initiate shipments &amp; print labels</div>
    <div class="perm"><span class="pi">✓</span> Access shop info &amp; settings</div>
  </div>
  <button class="btn bp" id="ab" onclick="authorize()">Authorize</button>
  <button class="btn bs" onclick="window.close()">Cancel</button>
  <div class="mb">🟠 Shopee Mock API — Demo environment</div>
</div>
<script>function authorize(){const b=document.getElementById('ab');b.textContent='Authorizing...';b.disabled=true;setTimeout(()=>{window.location.href=${JSON.stringify(callbackUrl)};},800)}</script>
</body></html>`);
});

app.get('/api/v2/auth/callback', (req, res) => {
  const { code, shop_id, redirect } = req.query;
  if (redirect) { const sep = redirect.includes('?') ? '&' : '?'; return res.redirect(`${redirect}${sep}code=${code}&shop_id=${shop_id}`); }
  res.redirect(resolveOdooCallback(req, { code, shop_id }));
});

app.post('/api/v2/auth/token/get', (req, res) => {
  res.json({ error: '', message: '', request_id: rid(), response: {
    access_token: 'MOCK_ACCESS_TOKEN_' + Date.now(), refresh_token: 'MOCK_REFRESH_TOKEN_' + Date.now(),
    expire_in: 86400, refresh_expire_in: 2592000, shop_id_list: [DB.shop.shop_id], merchant_id_list: [],
  }});
});

app.post('/api/v2/auth/access_token/get', (req, res) => {
  res.json({ error: '', message: '', request_id: rid(), response: {
    access_token: 'MOCK_ACCESS_TOKEN_REFRESHED_' + Date.now(), refresh_token: 'MOCK_REFRESH_TOKEN_REFRESHED_' + Date.now(), expire_in: 86400,
  }});
});

// ─────────────────────────────────────────────────────────────────────
//  SHOP
// ─────────────────────────────────────────────────────────────────────
app.get('/api/v2/shop/get_shop_info', requireAuth, (req, res) => {
  res.json({ error: '', message: '', request_id: rid(), response: DB.shop });
});

// ─────────────────────────────────────────────────────────────────────
//  PRODUCTS
// ─────────────────────────────────────────────────────────────────────
app.get('/api/v2/product/get_item_list', requireAuth, (req, res) => {
  const offset   = parseInt(req.query.offset)    || 0;
  const pageSize = parseInt(req.query.page_size) || 50;
  const page     = DB.products.slice(offset, offset + pageSize);
  const hasMore  = offset + pageSize < DB.products.length;
  res.json({ error: '', message: '', request_id: rid(), response: {
    item: page.map(p => ({ item_id: p.item_id, item_status: 'NORMAL' })),
    total_count: DB.products.length, has_next_page: hasMore, next_offset: hasMore ? offset + pageSize : null,
  }});
});

app.get('/api/v2/product/get_item_base_info', requireAuth, (req, res) => {
  const raw   = req.query.item_id_list || '';
  const ids   = raw.split(',').map(Number).filter(Boolean);
  const items = ids.length ? DB.products.filter(p => ids.includes(p.item_id)) : DB.products;
  res.json({ error: '', message: '', request_id: rid(), response: {
    item_list: items.map(p => {
      const synced = DB.syncedProducts[p.item_id];
      return {
        item_id: p.item_id, item_name: p.name, item_status: 'NORMAL', sku: p.sku,
        price_info: [{ currency: 'PHP', original_price: p.price, current_price: p.price }],
        stock_info_v2: { summary_info: { total_reserved_stock: 0, total_available_stock: synced ? synced.stock : 100 } },
        image: { image_url_list: [`https://placehold.co/400x400/EE4D2D/fff?text=${encodeURIComponent(p.sku)}`] },
      };
    })
  }});
});

app.post('/api/v2/product/update_stock', requireAuth, (req, res) => {
  const { item_id, stock_list } = req.body;
  if (stock_list && stock_list[0]) {
    const entry    = stock_list[0];
    const newStock = entry.seller_stock ? entry.seller_stock[0].stock : (entry.normal_stock !== undefined ? entry.normal_stock : 0);
    const product  = DB.products.find(p => p.item_id === item_id);
    const sku      = product ? product.sku  : `ITEM-${item_id}`;
    const name     = product ? product.name : `Product #${item_id}`;
    DB.syncedProducts[item_id] = { item_id, sku, name, stock: newStock, source: 'odoo', last_sync: nowStr() };
    console.log(`[STOCK] ${sku}: → ${newStock}`);
  }
  res.json({ error: '', message: '', request_id: rid(), response: { item_id, update_time: ts() } });
});

// ─────────────────────────────────────────────────────────────────────
//  ORDERS
// ─────────────────────────────────────────────────────────────────────
app.get('/api/v2/order/get_order_list', requireAuth, (req, res) => {
  const timeFrom    = parseInt(req.query.update_time_from || req.query.create_time_from) || 0;
  const timeTo      = parseInt(req.query.update_time_to   || req.query.create_time_to)   || ts();
  const orderStatus = req.query.order_status;
  DB.orders.forEach(o => { if (o.update_time < timeFrom) o.update_time = ts() - 60; });
  let orders = DB.orders.filter(o => o.update_time >= timeFrom && o.update_time <= timeTo);
  if (orderStatus) orders = orders.filter(o => o.order_status === orderStatus);
  res.json({ error: '', message: '', request_id: rid(), response: {
    order_list: orders.map(o => ({ order_sn: o.order_sn, order_status: o.order_status, create_time: o.create_time, update_time: o.update_time })),
    more: false, next_cursor: '',
  }});
});

app.get('/api/v2/order/get_order_detail', requireAuth, (req, res) => {
  const raw  = req.query.order_sn_list || '';
  const sns  = raw.split(',').map(s => s.trim()).filter(Boolean);
  const list = sns.length ? DB.orders.filter(o => sns.includes(o.order_sn)) : DB.orders;
  res.json({ error: '', message: '', request_id: rid(), response: {
    order_list: list.map(o => ({
      ...o, message_to_seller: '', note: '',
      pay_time: o.create_time + 300, days_to_ship: 3, ship_by_date: o.create_time + 86400 * 3,
      invoice_data: null, checkout_shipping_carrier: o.shipping_carrier, actual_shipping_cost: 0,
    }))
  }});
});

// ─────────────────────────────────────────────────────────────────────
//  LOGISTICS
// ─────────────────────────────────────────────────────────────────────
app.get('/api/v2/logistics/get_shipping_parameter', requireAuth, (req, res) => {
  res.json({ error: '', message: '', request_id: rid(), response: {
    order_sn: req.query.order_sn,
    pickup: { address_list: [{ address_id: 1, address: '123 Mock Warehouse St, Manila, PH',
      time_slot_list: [{ pickup_time_id: 'slot_001', date: new Date().toISOString().split('T')[0], time_text: '9:00 AM - 12:00 PM' }] }] },
    dropoff: { branch_list: [] }, non_integrated: null,
  }});
});

app.get('/api/v2/logistics/get_tracking_number', requireAuth, (req, res) => {
  const { order_sn } = req.query;
  if (!DB.trackingNumbers[order_sn]) {
    DB.trackingNumbers[order_sn] = 'PHSPX' + Date.now();
    const order = DB.orders.find(o => o.order_sn === order_sn);
    if (order) order.tracking_no = DB.trackingNumbers[order_sn];
  }
  res.json({ error: '', message: '', request_id: rid(), response: { tracking_number: DB.trackingNumbers[order_sn], plp_number: '', hint_message: '' } });
});

app.post('/api/v2/logistics/ship_order', requireAuth, (req, res) => {
  const { order_sn } = req.body;
  const order = DB.orders.find(o => o.order_sn === order_sn);
  if (!order) return res.json({ error: 'order_not_found', message: `Order ${order_sn} not found.`, request_id: rid(), response: {} });
  const tracking     = 'PHSPX' + Date.now();
  order.tracking_no  = tracking;
  order.order_status = 'SHIPPED';
  order.update_time  = ts();
  DB.trackingNumbers[order_sn] = tracking;
  DB.deliveryStatus[order_sn]  = 1;
  res.json({ error: '', message: '', request_id: rid(), response: { hint_message: 'Shipment initiated successfully.' } });
});

app.post('/api/v2/logistics/init_shipment', requireAuth, (req, res) => {
  const { order_sn } = req.body;
  const order = DB.orders.find(o => o.order_sn === order_sn);
  if (!order) return res.json({ error: 'order_not_found', message: `Order ${order_sn} not found.`, request_id: rid(), response: {} });
  const tracking     = 'PHSPX' + Date.now();
  order.tracking_no  = tracking;
  order.order_status = 'SHIPPED';
  order.update_time  = ts();
  DB.trackingNumbers[order_sn] = tracking;
  DB.deliveryStatus[order_sn]  = 1;
  res.json({ error: '', message: '', request_id: rid(), response: { order_sn, tracking_number: tracking, hint_message: 'Shipment initiated successfully.' } });
});

app.post('/api/v2/logistics/create_shipping_document', requireAuth, (req, res) => {
  const { order_list } = req.body;
  const result_list = (order_list || []).map(o => {
    DB.labelStatus[o.order_sn] = 'PROCESSING';
    return { order_sn: o.order_sn, status: 'PROCESSING', fail_error: '', fail_message: '' };
  });
  res.json({ error: '', message: '', request_id: rid(), response: { result_list } });
});

function handleDocResult(order_list) {
  return order_list.map(o => {
    if (DB.labelStatus[o.order_sn] === 'PROCESSING') DB.labelStatus[o.order_sn] = 'READY';
    return { order_sn: o.order_sn, status: DB.labelStatus[o.order_sn] || 'READY', fail_error: '', fail_message: '' };
  });
}

app.post('/api/v2/logistics/get_shipping_document_result', requireAuth, (req, res) => {
  res.json({ error: '', message: '', request_id: rid(), response: { result_list: handleDocResult(req.body.order_list || []) } });
});
app.get('/api/v2/logistics/get_shipping_document_result', requireAuth, (req, res) => {
  let ol = []; try { ol = JSON.parse(req.query.order_list || '[]'); } catch (e) {}
  res.json({ error: '', message: '', request_id: rid(), response: { result_list: handleDocResult(ol) } });
});

// ─────────────────────────────────────────────────────────────────────
//  download_shipping_document — FIXED FOR ODOO
//
//  ROOT CAUSE: The old endpoint returned a raw PDF binary (Content-Type:
//  application/pdf). Odoo's Shopee connector calls this endpoint and
//  expects a standard Shopee API JSON envelope:
//
//    { "error": "", "response": { "result_list": [{ "order_sn": "...",
//        "file_type": "PDF", "file_data": "<base64-encoded PDF>" }] } }
//
//  Returning a raw binary instead of that JSON caused Odoo to fail
//  silently — it could not parse the response and therefore never
//  attached or displayed the waybill PDF on the delivery order.
//
//  FIX: Build the PDF buffer, base64-encode it, and return it inside
//  the expected JSON envelope.  A ?raw=1 query param is kept so the
//  browser print-label button can still download a raw PDF directly.
// ─────────────────────────────────────────────────────────────────────
app.post('/api/v2/logistics/download_shipping_document', requireAuth, (req, res) => {
  const order_list = req.body.order_list || [];
  const order_sn   = order_list[0]?.order_sn || 'UNKNOWN';
  const order      = DB.orders.find(o => o.order_sn === order_sn);
  const tracking   = DB.trackingNumbers[order_sn] || 'N/A';
  if (!order) return res.json({ error: 'order_not_found', message: `Order ${order_sn} not found.`, request_id: rid(), response: {} });

  if (DB.labelStatus[order_sn]) DB.labelStatus[order_sn] = 'STORED';

  const pdfBuffer  = buildShippingLabelPDF(order, tracking);
  const pdfBase64  = pdfBuffer.toString('base64');

  // ?raw=1 → serve the binary directly (used by the browser label button)
  if (req.query.raw === '1') {
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="label_${order_sn}.pdf"`);
    return res.send(pdfBuffer);
  }

  // Default → JSON envelope expected by Odoo's Shopee connector
  res.json({
    error:      '',
    message:    '',
    request_id: rid(),
    response: {
      result_list: [{
        order_sn,
        status:    'READY',
        file_type: 'PDF',
        // This is what Odoo reads to attach the waybill to the delivery order
        file_data: pdfBase64,
        fail_error:   '',
        fail_message: '',
      }],
    },
  });
});

// ─────────────────────────────────────────────────────────────────────
//  WEBHOOK + 404
// ─────────────────────────────────────────────────────────────────────
app.post('/webhook/push', (req, res) => {
  console.log('[WEBHOOK]', JSON.stringify(req.body, null, 2));
  res.json({ code: 0, message: 'success', request_id: rid() });
});

app.use((req, res) => {
  console.warn(`[404] ${req.method} ${req.path}`);
  res.status(404).json({ error: 'endpoint_not_found', message: `${req.method} ${req.path} is not implemented.`, request_id: rid() });
});

app.listen(PORT, () => {
  console.log(`\n🟠 Shopee Mock API v4.0 running on port ${PORT}`);
  console.log(`   Partner ID   : ${PARTNER_ID}`);
  console.log(`   Partner Key  : ${PARTNER_KEY}`);
  console.log(`   Odoo base URL: ${ODOO_BASE_URL || '(not set)'}`);
  console.log(`   Strict sig   : ${process.env.STRICT_SIG || 'false (demo mode)'}\n`);
});
