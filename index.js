/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  SHOPEE MOCK API SERVER                                      ║
 * ║  Mimics Shopee Open Platform API for Odoo integration demo   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

const express = require('express');
const crypto  = require('crypto');
const app     = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── CONFIG ────────────────────────────────────────────────────────────
const PARTNER_ID  = process.env.PARTNER_ID  || '1';
const PARTNER_KEY = process.env.PARTNER_KEY || '1';
const PORT        = process.env.PORT        || 3000;
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

function rid() { return 'mock_' + Math.random().toString(36).slice(2, 10).toUpperCase(); }
function ts()  { return Math.floor(Date.now() / 1000); }

// ── ODOO CALLBACK RESOLVER ────────────────────────────────────────────
function resolveOdooCallback(req, extraParams) {
  const ODOO_CALLBACK_PATH = '/web/action/shopee_connector.action_shopee_auth_callback';
  let odooBase = ODOO_BASE_URL;
  if (!odooBase) {
    const referer = req.get('Referer') || req.get('Origin') || '';
    if (referer) {
      try { const u = new URL(referer); odooBase = `${u.protocol}//${u.host}`; } catch (_) {}
    }
  }
  if (!odooBase) {
    console.warn('[AUTH] ODOO_BASE_URL not set — cannot redirect to Odoo.');
    const self = `${req.protocol}://${req.get('host')}`;
    return `${self}/api/v2/auth/callback?${new URLSearchParams(extraParams).toString()}`;
  }
  return `${odooBase}${ODOO_CALLBACK_PATH}?${new URLSearchParams(extraParams).toString()}`;
}

// ── BUILD AUTH URL ────────────────────────────────────────────────────
// Odoo sends 'redirect' (not 'redirect_url') containing its full callback URL
// including account_id, company_id, timestamp and sign path segments.
function buildAuthUrl(req) {
  const { redirect, redirect_url } = req.query;
  const self = `${req.protocol}://${req.get('host')}`;

  const odooCallback = redirect
    || redirect_url
    || (ODOO_BASE_URL
        ? `${ODOO_BASE_URL}/web/action/shopee_connector.action_shopee_auth_callback`
        : null);

  const params = new URLSearchParams({
    shop_id: DB.shop.shop_id,
    code:    'MOCK_AUTH_CODE_2026',
    ...(odooCallback ? { redirect_url: odooCallback } : {}),
  });
  return `${self}/api/v2/auth/authorize?${params.toString()}`;
}

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
    { item_id: 10001, model_id: 0, name: "Lay's Classic Salted Chips 60g",          description: "Snacks / Chips",         category_id: 100, price: 62,  stock: 100, sku: 'LAYS-001', status: 'NORMAL' },
    { item_id: 10002, model_id: 0, name: "Lay's Cheese & Onion Chips 60g",          description: "Snacks / Chips",         category_id: 100, price: 62,  stock: 100, sku: 'LAYS-002', status: 'NORMAL' },
    { item_id: 10003, model_id: 0, name: "Lay's BBQ Chips 60g",                     description: "Snacks / Chips",         category_id: 100, price: 62,  stock: 100, sku: 'LAYS-003', status: 'NORMAL' },
    { item_id: 10004, model_id: 0, name: "Lay's Sour Cream & Onion 85g",            description: "Snacks / Chips",         category_id: 100, price: 89,  stock: 100, sku: 'LAYS-004', status: 'NORMAL' },
    { item_id: 10005, model_id: 0, name: "Cheetos Crunchy 80g",                     description: "Snacks / Chips",         category_id: 100, price: 62,  stock: 100, sku: 'CHTO-001', status: 'NORMAL' },
    { item_id: 10006, model_id: 0, name: "Cheetos Puffs 80g",                       description: "Snacks / Chips",         category_id: 100, price: 62,  stock: 100, sku: 'CHTO-002', status: 'NORMAL' },
    { item_id: 10007, model_id: 0, name: "Cheetos Flamin' Hot 80g",                 description: "Snacks / Chips",         category_id: 100, price: 62,  stock: 100, sku: 'CHTO-003', status: 'NORMAL' },
    { item_id: 10008, model_id: 0, name: "Doritos Nacho Cheese 100g",               description: "Snacks / Chips",         category_id: 100, price: 75,  stock: 100, sku: 'DORI-001', status: 'NORMAL' },
    { item_id: 10009, model_id: 0, name: "Doritos Cool Ranch 100g",                 description: "Snacks / Chips",         category_id: 100, price: 75,  stock: 100, sku: 'DORI-002', status: 'NORMAL' },
    { item_id: 10010, model_id: 0, name: "Doritos Spicy Sweet Chili 100g",          description: "Snacks / Chips",         category_id: 100, price: 75,  stock: 100, sku: 'DORI-003', status: 'NORMAL' },
    { item_id: 10011, model_id: 0, name: "Quaker Oats 800g",                        description: "Breakfast / Cereals",    category_id: 200, price: 149, stock: 100, sku: 'QKRO-001', status: 'NORMAL' },
    { item_id: 10012, model_id: 0, name: "Quaker Instant Oatmeal Sachet 40g",       description: "Breakfast / Cereals",    category_id: 200, price: 35,  stock: 100, sku: 'QKRO-002', status: 'NORMAL' },
    { item_id: 10013, model_id: 0, name: "Quaker Oats Granola Honey 400g",          description: "Breakfast / Cereals",    category_id: 200, price: 189, stock: 100, sku: 'QKRO-003', status: 'NORMAL' },
    { item_id: 10014, model_id: 0, name: "Quaker Chewy Granola Bar Choc Chip 42g",  description: "Snacks / Bars",          category_id: 101, price: 45,  stock: 100, sku: 'QKRO-004', status: 'NORMAL' },
    { item_id: 10015, model_id: 0, name: "M&M's Milk Chocolate 100g",               description: "Confectionery",          category_id: 300, price: 129, stock: 100, sku: 'MNMS-001', status: 'NORMAL' },
    { item_id: 10016, model_id: 0, name: "M&M's Peanut 100g",                       description: "Confectionery",          category_id: 300, price: 129, stock: 100, sku: 'MNMS-002', status: 'NORMAL' },
    { item_id: 10017, model_id: 0, name: "M&M's Crispy 100g",                       description: "Confectionery",          category_id: 300, price: 129, stock: 100, sku: 'MNMS-003', status: 'NORMAL' },
    { item_id: 10018, model_id: 0, name: "Snickers Bar 52g",                        description: "Confectionery",          category_id: 300, price: 45,  stock: 100, sku: 'SNIC-001', status: 'NORMAL' },
    { item_id: 10019, model_id: 0, name: "Snickers Peanut Butter Bar 52g",          description: "Confectionery",          category_id: 300, price: 49,  stock: 100, sku: 'SNIC-002', status: 'NORMAL' },
    { item_id: 10020, model_id: 0, name: "Snickers Miniatures 240g",                description: "Confectionery",          category_id: 300, price: 249, stock: 100, sku: 'SNIC-003', status: 'NORMAL' },
    { item_id: 10021, model_id: 0, name: "Nutella Hazelnut Spread 350g",             description: "Spreads",                category_id: 400, price: 259, stock: 100, sku: 'NUTE-001', status: 'NORMAL' },
    { item_id: 10022, model_id: 0, name: "Nutella Hazelnut Spread 750g",             description: "Spreads",                category_id: 400, price: 499, stock: 100, sku: 'NUTE-002', status: 'NORMAL' },
    { item_id: 10023, model_id: 0, name: "Nutella & Go Snack Pack 48g",              description: "Snacks / Bars",          category_id: 101, price: 65,  stock: 100, sku: 'NUTE-003', status: 'NORMAL' },
    { item_id: 10024, model_id: 0, name: "Tic Tac Orange 16g",                      description: "Confectionery / Candy",  category_id: 301, price: 25,  stock: 100, sku: 'TICT-001', status: 'NORMAL' },
    { item_id: 10025, model_id: 0, name: "Tic Tac Mint 16g",                        description: "Confectionery / Candy",  category_id: 301, price: 25,  stock: 100, sku: 'TICT-002', status: 'NORMAL' },
    { item_id: 10026, model_id: 0, name: "Tic Tac Strawberry 16g",                  description: "Confectionery / Candy",  category_id: 301, price: 25,  stock: 100, sku: 'TICT-003', status: 'NORMAL' },
    { item_id: 10027, model_id: 0, name: "Tic Tac Lime & Orange Mix 16g",           description: "Confectionery / Candy",  category_id: 301, price: 25,  stock: 100, sku: 'TICT-004', status: 'NORMAL' },
    { item_id: 10028, model_id: 0, name: "Loacker Classic Vanilla 175g",            description: "Snacks / Biscuits",      category_id: 102, price: 135, stock: 100, sku: 'LOAC-001', status: 'NORMAL' },
    { item_id: 10029, model_id: 0, name: "Loacker Chocolate Wafer 175g",            description: "Snacks / Biscuits",      category_id: 102, price: 135, stock: 100, sku: 'LOAC-002', status: 'NORMAL' },
    { item_id: 10030, model_id: 0, name: "Loacker Hazelnut Wafer 175g",             description: "Snacks / Biscuits",      category_id: 102, price: 135, stock: 100, sku: 'LOAC-003', status: 'NORMAL' },
    { item_id: 10031, model_id: 0, name: "Pedigree Adult Dry Dog Food 3kg",         description: "Pet Food / Dog",         category_id: 700, price: 399, stock: 100, sku: 'PEDI-001', status: 'NORMAL' },
    { item_id: 10032, model_id: 0, name: "Pedigree Puppy Dry Dog Food 1.5kg",       description: "Pet Food / Dog",         category_id: 700, price: 249, stock: 100, sku: 'PEDI-002', status: 'NORMAL' },
    { item_id: 10033, model_id: 0, name: "Pedigree Wet Dog Food Beef 130g",         description: "Pet Food / Dog",         category_id: 700, price: 45,  stock: 100, sku: 'PEDI-003', status: 'NORMAL' },
    { item_id: 10034, model_id: 0, name: "Pedigree DentaStix Daily Oral Care 7s",  description: "Pet Food / Dog",         category_id: 700, price: 119, stock: 100, sku: 'PEDI-004', status: 'NORMAL' },
    { item_id: 10035, model_id: 0, name: "Ferrero Rocher 3pcs Box",                 description: "Confectionery",          category_id: 300, price: 89,  stock: 100, sku: 'FERR-001', status: 'NORMAL' },
    { item_id: 10036, model_id: 0, name: "Ferrero Rocher 16pcs Box 200g",           description: "Confectionery",          category_id: 300, price: 419, stock: 100, sku: 'FERR-002', status: 'NORMAL' },
    { item_id: 10037, model_id: 0, name: "Ferrero Rocher 24pcs Box 300g",           description: "Confectionery",          category_id: 300, price: 599, stock: 100, sku: 'FERR-003', status: 'NORMAL' },
    { item_id: 10038, model_id: 0, name: "Swiss Miss Hot Cocoa Mix 28g Sachet",     description: "Beverages / Hot Drinks", category_id: 500, price: 29,  stock: 100, sku: 'SWMS-001', status: 'NORMAL' },
    { item_id: 10039, model_id: 0, name: "Swiss Miss Milk Chocolate Mix 10s",       description: "Beverages / Hot Drinks", category_id: 500, price: 259, stock: 100, sku: 'SWMS-002', status: 'NORMAL' },
    { item_id: 10040, model_id: 0, name: "Swiss Miss Dark Chocolate Mix 10s",       description: "Beverages / Hot Drinks", category_id: 500, price: 275, stock: 100, sku: 'SWMS-003', status: 'NORMAL' },
    { item_id: 10041, model_id: 0, name: "Dole Pineapple Juice 240ml Can",          description: "Beverages / Juice",      category_id: 501, price: 35,  stock: 100, sku: 'DOLE-001', status: 'NORMAL' },
    { item_id: 10042, model_id: 0, name: "Dole Pineapple Chunks in Juice 227g",     description: "Food / Canned Fruit",    category_id: 600, price: 69,  stock: 100, sku: 'DOLE-002', status: 'NORMAL' },
    { item_id: 10043, model_id: 0, name: "Dole Tropical Fruit Salad 227g",          description: "Food / Canned Fruit",    category_id: 600, price: 79,  stock: 100, sku: 'DOLE-003', status: 'NORMAL' },
    { item_id: 10044, model_id: 0, name: "Dole Crushed Pineapple 227g",             description: "Food / Canned Fruit",    category_id: 600, price: 65,  stock: 100, sku: 'DOLE-004', status: 'NORMAL' },
    { item_id: 10045, model_id: 0, name: "Reynolds Wrap Aluminum Foil 37.2 sqft",  description: "Household / Kitchen",    category_id: 800, price: 149, stock: 100, sku: 'REYN-001', status: 'NORMAL' },
    { item_id: 10046, model_id: 0, name: "Reynolds Wrap Heavy Duty Foil 50 sqft",  description: "Household / Kitchen",    category_id: 800, price: 199, stock: 100, sku: 'REYN-002', status: 'NORMAL' },
    { item_id: 10047, model_id: 0, name: "Reynolds Kitchens Parchment Paper 30sqft", description: "Household / Kitchen",  category_id: 800, price: 129, stock: 100, sku: 'REYN-003', status: 'NORMAL' },
    { item_id: 10048, model_id: 0, name: "Reynolds Oven Bags Turkey Size 2s",       description: "Household / Kitchen",    category_id: 800, price: 119, stock: 100, sku: 'REYN-004', status: 'NORMAL' },
    { item_id: 10049, model_id: 0, name: "Reynolds Wrap Non-Stick Foil 35 sqft",   description: "Household / Kitchen",    category_id: 800, price: 169, stock: 100, sku: 'REYN-005', status: 'NORMAL' },
    { item_id: 10050, model_id: 0, name: "Reynolds Cut-Rite Wax Paper 75 sqft",    description: "Household / Kitchen",    category_id: 800, price: 109, stock: 100, sku: 'REYN-006', status: 'NORMAL' },
  ],

  // Orders must have fulfillment_flag = 'fulfilled_by_local_seller' (fbm)
  // and status READY_TO_SHIP or PROCESSED for Odoo to import them.
  orders: [
    {
      order_sn: 'SPX20260521001',
      order_status: 'READY_TO_SHIP',
      fulfillment_flag: 'fulfilled_by_local_seller',
      create_time: ts() - 3600,
      update_time: ts() - 1800,
      buyer_user_id: 'buyer_001',
      buyer_username: 'juan_delacruz',
      shipping_carrier: 'SPX Express',
      currency: 'PHP',
      total_amount: 515,
      estimated_shipping_fee: 0,
      actual_shipping_fee: 0,
      actual_shipping_fee_confirmed: false,
      tracking_no: '',
      package_list: [{ package_number: '', logistics_status: 'LOGISTICS_REQUEST_CREATED', shipping_carrier: 'SPX Express', item_list: [] }],
      recipient_address: {
        name: 'Juan Dela Cruz',
        phone: '+639171234567',
        full_address: '123 Rizal Street, Barangay San Antonio, Makati, Metro Manila, 1200, PH',
        city: 'Makati',
        state: 'Metro Manila',
        region: 'PH',
        zipcode: '1200',
      },
      item_list: [
        { item_id: 10001, model_id: 0, item_name: "Lay's Classic Salted Chips 60g", item_sku: 'LAYS-001', model_sku: 'LAYS-001', model_quantity_purchased: 3, model_original_price: 62, model_discounted_price: 62, promotion_id: null, promotion_type: null },
        { item_id: 10008, model_id: 0, item_name: "Doritos Nacho Cheese 100g",       item_sku: 'DORI-001', model_sku: 'DORI-001', model_quantity_purchased: 2, model_original_price: 75, model_discounted_price: 75, promotion_id: null, promotion_type: null },
        { item_id: 10015, model_id: 0, item_name: "M&M's Milk Chocolate 100g",       item_sku: 'MNMS-001', model_sku: 'MNMS-001', model_quantity_purchased: 1, model_original_price: 129, model_discounted_price: 129, promotion_id: null, promotion_type: null },
      ],
    },
    {
      order_sn: 'SPX20260521002',
      order_status: 'READY_TO_SHIP',
      fulfillment_flag: 'fulfilled_by_local_seller',
      create_time: ts() - 86400,
      update_time: ts() - 43200,
      buyer_user_id: 'buyer_002',
      buyer_username: 'maria_santos',
      shipping_carrier: 'SPX Express',
      currency: 'PHP',
      total_amount: 874,
      estimated_shipping_fee: 0,
      actual_shipping_fee: 0,
      actual_shipping_fee_confirmed: false,
      tracking_no: '',
      package_list: [{ package_number: '', logistics_status: 'LOGISTICS_REQUEST_CREATED', shipping_carrier: 'SPX Express', item_list: [] }],
      recipient_address: {
        name: 'Maria Santos',
        phone: '+639289876543',
        full_address: '456 Bonifacio Avenue, Barangay Poblacion, Cebu City, Cebu, 6000, PH',
        city: 'Cebu City',
        state: 'Cebu',
        region: 'PH',
        zipcode: '6000',
      },
      item_list: [
        { item_id: 10021, model_id: 0, item_name: "Nutella Hazelnut Spread 350g", item_sku: 'NUTE-001', model_sku: 'NUTE-001', model_quantity_purchased: 2, model_original_price: 259, model_discounted_price: 259, promotion_id: null, promotion_type: null },
        { item_id: 10035, model_id: 0, item_name: "Ferrero Rocher 3pcs Box",      item_sku: 'FERR-001', model_sku: 'FERR-001', model_quantity_purchased: 4, model_original_price: 89,  model_discounted_price: 89,  promotion_id: null, promotion_type: null },
      ],
    },
    {
      order_sn: 'SPX20260521003',
      order_status: 'READY_TO_SHIP',
      fulfillment_flag: 'fulfilled_by_local_seller',
      create_time: ts() - 7200,
      update_time: ts() - 3600,
      buyer_user_id: 'buyer_003',
      buyer_username: 'jose_reyes',
      shipping_carrier: 'J&T Express',
      currency: 'PHP',
      total_amount: 337,
      estimated_shipping_fee: 0,
      actual_shipping_fee: 0,
      actual_shipping_fee_confirmed: false,
      tracking_no: '',
      package_list: [{ package_number: '', logistics_status: 'LOGISTICS_REQUEST_CREATED', shipping_carrier: 'J&T Express', item_list: [] }],
      recipient_address: {
        name: 'Jose Reyes',
        phone: '+639351112222',
        full_address: '789 Quezon Boulevard, Barangay Malate, Davao City, Davao del Sur, 8000, PH',
        city: 'Davao City',
        state: 'Davao del Sur',
        region: 'PH',
        zipcode: '8000',
      },
      item_list: [
        { item_id: 10011, model_id: 0, item_name: "Quaker Oats 800g",    item_sku: 'QKRO-001', model_sku: 'QKRO-001', model_quantity_purchased: 1, model_original_price: 149, model_discounted_price: 149, promotion_id: null, promotion_type: null },
        { item_id: 10005, model_id: 0, item_name: "Cheetos Crunchy 80g", item_sku: 'CHTO-001', model_sku: 'CHTO-001', model_quantity_purchased: 2, model_original_price: 62,  model_discounted_price: 62,  promotion_id: null, promotion_type: null },
        { item_id: 10024, model_id: 0, item_name: "Tic Tac Orange 16g",  item_sku: 'TICT-001', model_sku: 'TICT-001', model_quantity_purchased: 3, model_original_price: 25,  model_discounted_price: 25,  promotion_id: null, promotion_type: null },
      ],
    },
  ],

  // Track label state per order_sn: not_available → processing → ready → stored
  labelStatus: {},
  trackingNumbers: {},
};

// ─────────────────────────────────────────────────────────────────────
//  ROOT — demo dashboard
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
.section{background:white;border:1px solid #e5e5e5;border-radius:10px;margin-bottom:14px;overflow:hidden}
.section-header{padding:12px 16px;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;justify-content:space-between}
.section-title{font-size:13px;font-weight:600}
.btn{padding:6px 14px;border-radius:7px;font-size:12px;cursor:pointer;border:none;font-weight:600;transition:all .15s}
.btn-primary{background:#EE4D2D;color:white}.btn-primary:hover:not(:disabled){background:#d94426}
.btn-primary:disabled{background:#ccc;cursor:not-allowed}
.btn-outline{background:transparent;border:1px solid #ddd;color:#333}.btn-outline:hover:not(:disabled){background:#f5f5f5}
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
.empty{color:#bbb;text-align:center;padding:24px;font-size:12px}
.mono{font-family:'SF Mono',monospace;font-size:11px}
.warn{background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:10px 14px;font-size:12px;color:#92400e;margin-bottom:14px}
.banner{background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:12px 16px;display:flex;align-items:center;gap:8px;margin-bottom:14px}
.banner span{font-size:13px;color:#15803d;font-weight:500}
.shop-info{display:flex;align-items:center;gap:12px;padding:12px 16px}
.shop-avatar{width:38px;height:38px;background:#FFF3E0;border-radius:9px;display:flex;align-items:center;justify-content:center;color:#EE4D2D;font-size:18px;flex-shrink:0}
.shop-name{font-size:13px;font-weight:600}
.shop-meta{font-size:11px;color:#888;margin-top:2px}
</style>
</head>
<body>
<div class="header">
  <div class="header-logo">S</div>
  <h1>Shopee Mock API &mdash; Demo Dashboard</h1>
  <span class="badge"><span class="dot"></span>Live &nbsp;&bull;&nbsp; v3.0.0 &nbsp;&bull;&nbsp; Partner ID: ${PARTNER_ID}</span>
</div>
<div class="container">
  ${!ODOO_BASE_URL ? `<div class="warn">⚠️ <strong>ODOO_BASE_URL</strong> is not set. OAuth callback cannot redirect to Odoo. Set this to your Odoo instance URL.</div>` : ''}
  <div class="banner"><span>&#x1F7E2; Mock server ready &mdash; Demo Shopee Store PH (ID: 123456, Region: PH, ${DB.orders.length} orders, ${DB.products.length} products)</span></div>
  <div class="cards">
    <div class="card"><div class="card-label">Products</div><div class="card-value orange">${DB.products.length}</div></div>
    <div class="card"><div class="card-label">Orders</div><div class="card-value">${DB.orders.length}</div></div>
    <div class="card"><div class="card-label">Endpoint</div><div class="card-value orange" style="font-size:12px;margin-top:4px">${req.protocol}://${req.get('host')}</div></div>
    <div class="card"><div class="card-label">Odoo URL</div><div class="card-value" style="font-size:11px;margin-top:4px;color:#888">${ODOO_BASE_URL || 'Not set'}</div></div>
  </div>
  <div class="section">
    <div class="section-header"><span class="section-title">Orders (${DB.orders.length})</span></div>
    <table>
      <thead><tr><th>Order No.</th><th>Customer</th><th>Items</th><th>Amount</th><th>Status</th><th>Fulfillment</th></tr></thead>
      <tbody>
        ${DB.orders.map(o => `<tr>
          <td class="mono">${o.order_sn}</td>
          <td>${o.recipient_address.name}</td>
          <td style="color:#888">${o.item_list.map(i => i.item_name.split(' ').slice(0,3).join(' ') + ' x' + i.model_quantity_purchased).join(', ')}</td>
          <td style="font-weight:600">&#8369;${o.total_amount}</td>
          <td><span class="status ${o.order_status === 'SHIPPED' ? 'shipped' : 'ready'}">${o.order_status}</span></td>
          <td style="color:#888;font-size:11px">${o.fulfillment_flag}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>
  <div class="section">
    <div class="section-header"><span class="section-title">Products (${DB.products.length})</span></div>
    <table>
      <thead><tr><th>SKU</th><th>Product Name</th><th>Price</th><th>Stock</th><th>Status</th></tr></thead>
      <tbody>
        ${DB.products.slice(0,15).map(p => `<tr>
          <td class="mono">${p.sku}</td>
          <td>${p.name}</td>
          <td>&#8369;${p.price}</td>
          <td>${p.stock}</td>
          <td><span class="status normal">NORMAL</span></td>
        </tr>`).join('')}
        <tr><td colspan="5" style="text-align:center;color:#bbb;font-size:11px;padding:8px">... and ${DB.products.length - 15} more products</td></tr>
      </tbody>
    </table>
  </div>
</div>
</body>
</html>`);
});

// ─────────────────────────────────────────────────────────────────────
//  AUTH — auth_partner (Odoo calls this server-side, expects JSON)
// ─────────────────────────────────────────────────────────────────────
app.get('/api/v2/shop/auth_partner', (req, res) => {
  console.log('[AUTH] auth_partner — query:', req.query);
  const auth_url = buildAuthUrl(req);
  console.log('[AUTH] auth_url:', auth_url);
  res.json({ error: '', message: '', request_id: rid(), response: { auth_url } });
});

// ─────────────────────────────────────────────────────────────────────
//  AUTH — get_auth_link (same as above, alternate endpoint)
// ─────────────────────────────────────────────────────────────────────
app.get('/api/v2/auth/shop/get_auth_link', (req, res) => {
  console.log('[AUTH] get_auth_link — query:', req.query);
  const auth_url = buildAuthUrl(req);
  console.log('[AUTH] auth_url:', auth_url);
  res.json({ error: '', message: '', request_id: rid(), response: { auth_url } });
});

// ─────────────────────────────────────────────────────────────────────
//  AUTH — authorize page (browser-facing, user clicks Authorize here)
// ─────────────────────────────────────────────────────────────────────
app.get('/api/v2/auth/authorize', (req, res) => {
  const { redirect_url, shop_id, code } = req.query;
  const callbackUrl = redirect_url
    ? `${redirect_url}${redirect_url.includes('?') ? '&' : '?'}code=${code || 'MOCK_AUTH_CODE_2026'}&shop_id=${shop_id || DB.shop.shop_id}`
    : resolveOdooCallback(req, { code: code || 'MOCK_AUTH_CODE_2026', shop_id: shop_id || DB.shop.shop_id });

  console.log('[AUTH] authorize page — callbackUrl:', callbackUrl);

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Shopee — Authorize App</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{background:white;border-radius:16px;padding:32px;max-width:400px;width:90%;box-shadow:0 4px 24px rgba(0,0,0,0.08);text-align:center}
.logo{width:56px;height:56px;background:#EE4D2D;border-radius:14px;display:flex;align-items:center;justify-content:center;color:white;font-size:26px;font-weight:700;margin:0 auto 16px}
h2{font-size:18px;margin-bottom:6px}
.sub{font-size:13px;color:#888;margin-bottom:24px}
.shop-box{background:#fff8f6;border:1px solid #fde0d8;border-radius:10px;padding:14px;margin-bottom:24px;text-align:left}
.shop-box .label{font-size:11px;color:#aaa;margin-bottom:2px}
.shop-box .value{font-size:13px;font-weight:600;color:#1a1a1a}
.permissions{text-align:left;margin-bottom:24px}
.perm{display:flex;align-items:center;gap:8px;font-size:12px;color:#555;padding:5px 0;border-bottom:1px solid #f5f5f5}
.perm:last-child{border-bottom:none}
.perm-icon{color:#16a34a}
.btn{display:block;width:100%;padding:13px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;border:none;transition:all .15s;margin-bottom:10px}
.btn-primary{background:#EE4D2D;color:white}.btn-primary:hover{background:#d94426}
.btn-secondary{background:#f5f5f5;color:#555}.btn-secondary:hover{background:#eee}
.mock-badge{font-size:10px;color:#bbb;margin-top:16px}
</style>
</head>
<body>
<div class="card">
  <div class="logo">S</div>
  <h2>Authorize App Access</h2>
  <p class="sub">An app is requesting access to your Shopee store</p>
  <div class="shop-box">
    <div class="label">Store</div>
    <div class="value">${DB.shop.shop_name}</div>
    <div class="label" style="margin-top:8px">Shop ID</div>
    <div class="value">${DB.shop.shop_id} &nbsp;&middot;&nbsp; ${DB.shop.region}</div>
  </div>
  <div class="permissions">
    <div class="perm"><span class="perm-icon">&#10003;</span> Read and manage products &amp; inventory</div>
    <div class="perm"><span class="perm-icon">&#10003;</span> Read and manage orders</div>
    <div class="perm"><span class="perm-icon">&#10003;</span> Initiate shipments &amp; print labels</div>
    <div class="perm"><span class="perm-icon">&#10003;</span> Access shop info &amp; settings</div>
  </div>
  <button class="btn btn-primary" id="auth-btn" onclick="authorize()">Authorize</button>
  <button class="btn btn-secondary" onclick="window.close()">Cancel</button>
  <div class="mock-badge">&#x1F7E0; Shopee Mock API &mdash; Demo environment</div>
</div>
<script>
function authorize() {
  const btn = document.getElementById('auth-btn');
  btn.textContent = 'Authorizing...';
  btn.disabled = true;
  setTimeout(() => { window.location.href = ${JSON.stringify(callbackUrl)}; }, 800);
}
</script>
</body>
</html>`);
});

// ─────────────────────────────────────────────────────────────────────
//  AUTH — callback fallback
// ─────────────────────────────────────────────────────────────────────
app.get('/api/v2/auth/callback', (req, res) => {
  const { code, shop_id, redirect } = req.query;
  console.log('[AUTH] callback — query:', req.query);
  if (redirect) {
    const sep = redirect.includes('?') ? '&' : '?';
    return res.redirect(`${redirect}${sep}code=${code}&shop_id=${shop_id}`);
  }
  const destination = resolveOdooCallback(req, { code, shop_id });
  console.log('[AUTH] redirecting to:', destination);
  res.redirect(destination);
});

// ─────────────────────────────────────────────────────────────────────
//  AUTH — token exchange
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
//  AUTH — token refresh
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
  const filtered   = DB.products.filter(p => p.status === itemStatus || itemStatus === 'ALL');
  const page       = filtered.slice(offset, offset + pageSize);
  const hasMore    = offset + pageSize < filtered.length;
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
  const items = ids.length ? DB.products.filter(p => ids.includes(p.item_id)) : DB.products;
  res.json({
    error: '', message: '', request_id: rid(),
    response: {
      item_list: items.map(p => ({
        item_id:      p.item_id,
        item_name:    p.name,
        description:  p.description,
        category_id:  p.category_id,
        item_status:  p.status,
        sku:          p.sku,
        price_info: [{
          currency:                             'PHP',
          original_price:                       p.price,
          current_price:                        p.price,
          inflated_price_of_original_price:     p.price,
        }],
        stock_info_v2: {
          summary_info: { total_reserved_stock: 0, total_available_stock: p.stock }
        },
        image: { image_url_list: [`https://placehold.co/400x400/EE4D2D/fff?text=${encodeURIComponent(p.sku)}`] },
      }))
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
//  PRODUCTS — update_stock
//  Odoo sends seller_stock array; also supports legacy normal_stock.
// ─────────────────────────────────────────────────────────────────────
app.post('/api/v2/product/update_stock', requireAuth, (req, res) => {
  const { item_id, stock_list } = req.body;
  const product = DB.products.find(p => p.item_id === item_id);
  if (!product) {
    return res.json({ error: 'item_not_found', message: `Item ${item_id} not found.`, request_id: rid(), response: {} });
  }
  if (stock_list && stock_list[0]) {
    const entry = stock_list[0];
    // Odoo sends seller_stock: [{ stock: N }]; fallback to normal_stock for legacy
    const newStock = entry.seller_stock
      ? entry.seller_stock[0].stock
      : entry.normal_stock;
    console.log(`[STOCK] ${product.sku}: ${product.stock} → ${newStock}`);
    product.stock = newStock;
  }
  res.json({ error: '', message: '', request_id: rid(), response: { item_id, update_time: ts() } });
});

// ─────────────────────────────────────────────────────────────────────
//  ORDERS — get_order_list
//  Odoo uses update_time range and cursor-based pagination.
// ─────────────────────────────────────────────────────────────────────
app.get('/api/v2/order/get_order_list', requireAuth, (req, res) => {
  const timeFrom = parseInt(req.query.update_time_from || req.query.create_time_from) || 0;
  const timeTo   = parseInt(req.query.update_time_to   || req.query.create_time_to)   || ts();

  // Always freshen update_time so orders are never stale vs Odoo's last sync
  DB.orders.forEach(o => { o.update_time = ts() - 60; });

  let orders = DB.orders.filter(o => o.update_time >= timeFrom && o.update_time <= timeTo);
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
//  Returns full order objects with all fields Odoo needs to create
//  sales orders, partners, and order lines.
// ─────────────────────────────────────────────────────────────────────
app.get('/api/v2/order/get_order_detail', requireAuth, (req, res) => {
  const raw  = req.query.order_sn_list || '';
  const sns  = raw.split(',').map(s => s.trim()).filter(Boolean);
  const list = sns.length ? DB.orders.filter(o => sns.includes(o.order_sn)) : DB.orders;

  res.json({
    error: '', message: '', request_id: rid(),
    response: {
      order_list: list.map(o => ({
        order_sn:                      o.order_sn,
        order_status:                  o.order_status,
        fulfillment_flag:              o.fulfillment_flag,
        create_time:                   o.create_time,
        update_time:                   o.update_time,
        buyer_user_id:                 o.buyer_user_id,
        buyer_username:                o.buyer_username,
        shipping_carrier:              o.shipping_carrier,
        currency:                      o.currency,
        total_amount:                  o.total_amount,
        estimated_shipping_fee:        o.estimated_shipping_fee,
        actual_shipping_fee:           o.actual_shipping_fee,
        actual_shipping_fee_confirmed: o.actual_shipping_fee_confirmed,
        tracking_no:                   o.tracking_no,
        package_list:                  o.package_list,
        recipient_address:             o.recipient_address,
        item_list:                     o.item_list,
        message_to_seller:             '',
        note:                          '',
        pay_time:                      o.create_time + 300,
        days_to_ship:                  3,
        ship_by_date:                  o.create_time + 86400 * 3,
        invoice_data:                  null,
        checkout_shipping_carrier:     o.shipping_carrier,
        actual_shipping_cost:          0,
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
          address: '123 Mock Warehouse St, Manila, PH',
          time_slot_list: [{
            pickup_time_id: 'slot_001',
            date: new Date().toISOString().split('T')[0],
            time_text: '9:00 AM - 12:00 PM',
          }],
        }],
      },
      dropoff: { branch_list: [] },
      non_integrated: null,
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
//  LOGISTICS — get_tracking_number
//  Odoo calls this to get/set carrier_tracking_ref on the picking.
//  Auto-assigns a tracking number if not already set.
// ─────────────────────────────────────────────────────────────────────
app.get('/api/v2/logistics/get_tracking_number', requireAuth, (req, res) => {
  const { order_sn } = req.query;
  if (!DB.trackingNumbers[order_sn]) {
    DB.trackingNumbers[order_sn] = 'PHSPX' + Date.now();
    const order = DB.orders.find(o => o.order_sn === order_sn);
    if (order) order.tracking_no = DB.trackingNumbers[order_sn];
    console.log(`[TRACKING] Assigned ${DB.trackingNumbers[order_sn]} to ${order_sn}`);
  }
  res.json({
    error: '', message: '', request_id: rid(),
    response: { tracking_number: DB.trackingNumbers[order_sn], plp_number: '', hint_message: '' }
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
  const tracking = 'PHSPX' + Date.now();
  order.tracking_no   = tracking;
  order.order_status  = 'SHIPPED';
  order.update_time   = ts();
  DB.trackingNumbers[order_sn] = tracking;
  order.item_list.forEach(item => {
    const product = DB.products.find(p => p.item_id === item.item_id);
    if (product) product.stock = Math.max(0, product.stock - item.model_quantity_purchased);
  });
  res.json({ error: '', message: '', request_id: rid(), response: { hint_message: 'Shipment initiated successfully.' } });
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
  const tracking = 'PHSPX' + Date.now();
  order.tracking_no   = tracking;
  order.order_status  = 'SHIPPED';
  order.update_time   = ts();
  DB.trackingNumbers[order_sn] = tracking;
  res.json({ error: '', message: '', request_id: rid(), response: { order_sn, tracking_number: tracking, hint_message: 'Shipment initiated successfully.' } });
});

// ─────────────────────────────────────────────────────────────────────
//  LOGISTICS — create_shipping_document
//  Odoo calls this to request label generation. Sets status to PROCESSING.
// ─────────────────────────────────────────────────────────────────────
app.post('/api/v2/logistics/create_shipping_document', requireAuth, (req, res) => {
  const { order_list } = req.body;
  const result_list = (order_list || []).map(o => {
    DB.labelStatus[o.order_sn] = 'PROCESSING';
    console.log(`[LABEL] ${o.order_sn} → PROCESSING`);
    return { order_sn: o.order_sn, status: 'PROCESSING', fail_error: '', fail_message: '' };
  });
  res.json({ error: '', message: '', request_id: rid(), response: { result_list } });
});

// ─────────────────────────────────────────────────────────────────────
//  LOGISTICS — get_shipping_document_result
//  Odoo calls this (via POST) to check label status.
//  Advances PROCESSING → READY automatically.
// ─────────────────────────────────────────────────────────────────────
app.post('/api/v2/logistics/get_shipping_document_result', requireAuth, (req, res) => {
  const order_list = req.body.order_list || [];
  const result_list = order_list.map(o => {
    if (DB.labelStatus[o.order_sn] === 'PROCESSING') {
      DB.labelStatus[o.order_sn] = 'READY';
      console.log(`[LABEL] ${o.order_sn} → READY`);
    }
    const status = DB.labelStatus[o.order_sn] || 'READY';
    return { order_sn: o.order_sn, status, fail_error: '', fail_message: '' };
  });
  res.json({ error: '', message: '', request_id: rid(), response: { result_list } });
});

// Also handle GET variant just in case
app.get('/api/v2/logistics/get_shipping_document_result', requireAuth, (req, res) => {
  let order_list = [];
  try { order_list = JSON.parse(req.query.order_list || '[]'); } catch (e) {}
  const result_list = order_list.map(o => {
    const status = DB.labelStatus[o.order_sn] || 'READY';
    return { order_sn: o.order_sn, status, fail_error: '', fail_message: '' };
  });
  res.json({ error: '', message: '', request_id: rid(), response: { result_list } });
});

// ─────────────────────────────────────────────────────────────────────
//  LOGISTICS — download_shipping_document
//  Odoo expects raw PDF bytes returned directly (not a URL).
//  We return a minimal valid PDF with the order details.
// ─────────────────────────────────────────────────────────────────────
app.post('/api/v2/logistics/download_shipping_document', requireAuth, (req, res) => {
  const order_list = req.body.order_list || [];
  const order_sn   = order_list[0]?.order_sn || 'UNKNOWN';
  const order      = DB.orders.find(o => o.order_sn === order_sn);
  const tracking   = DB.trackingNumbers[order_sn] || 'N/A';
  const recipient  = order ? order.recipient_address.name : 'Unknown';
  const address    = order ? order.recipient_address.full_address : '';

  // Minimal valid PDF with shipping label content
  const pdfContent = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 400 300]/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>>>endobj
4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
5 0 obj<</Length 320>>
stream
BT
/F1 16 Tf
30 260 Td (SHOPEE SHIPPING LABEL) Tj
/F1 11 Tf
0 -30 Td (Order: ${order_sn}) Tj
0 -18 Td (Tracking: ${tracking}) Tj
0 -18 Td (To: ${recipient}) Tj
/F1 9 Tf
0 -16 Td (${address.substring(0, 55)}) Tj
0 -14 Td (${address.substring(55, 110)}) Tj
/F1 10 Tf
0 -24 Td (Carrier: ${order ? order.shipping_carrier : 'SPX Express'}) Tj
0 -18 Td ([MOCK LABEL - Demo environment]) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000266 00000 n
0000000347 00000 n
trailer<</Size 6/Root 1 0 R>>
startxref
717
%%EOF`;

  if (DB.labelStatus[order_sn]) {
    DB.labelStatus[order_sn] = 'STORED';
    console.log(`[LABEL] ${order_sn} → STORED (downloaded)`);
  }

  res.set('Content-Type', 'application/pdf');
  res.send(Buffer.from(pdfContent));
});

// ─────────────────────────────────────────────────────────────────────
//  WEBHOOK RECEIVER
// ─────────────────────────────────────────────────────────────────────
app.post('/webhook/push', (req, res) => {
  console.log('[WEBHOOK]', JSON.stringify(req.body, null, 2));
  res.json({ code: 0, message: 'success', request_id: rid() });
});

// ─────────────────────────────────────────────────────────────────────
//  404 catch-all
// ─────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  console.warn(`[404] ${req.method} ${req.path}`);
  res.status(404).json({
    error: 'endpoint_not_found',
    message: `${req.method} ${req.path} is not implemented in this mock.`,
    request_id: rid(),
  });
});

app.listen(PORT, () => {
  console.log(`\n🟠 Shopee Mock API running on port ${PORT}`);
  console.log(`   Partner ID   : ${PARTNER_ID}`);
  console.log(`   Partner Key  : ${PARTNER_KEY}`);
  console.log(`   Odoo base URL: ${ODOO_BASE_URL || '(not set — add ODOO_BASE_URL env var)'}`);
  console.log(`   Strict sig   : ${process.env.STRICT_SIG || 'false (demo mode)'}\n`);
});
