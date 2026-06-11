'use strict';

const { Router } = require('express');
const { supabaseAdmin } = require('../services/supabase/client');
const { ok, fail, notFound, serverError } = require('../services/utils/response');

const router = Router();

const CATEGORIES = ['frigobar', 'bar', 'mercearia', 'extra'];
const EDITABLE = ['name', 'category', 'price', 'cost_price', 'unit', 'min_stock', 'active'];

// GET /api/products?category=bar&active=true
router.get('/', async (req, res) => {
  const { category, active } = req.query;

  let query = supabaseAdmin
    .from('products')
    .select('*')
    .order('category', { ascending: true })
    .order('name', { ascending: true });

  if (category) query = query.eq('category', category);
  if (active !== undefined) query = query.eq('active', active === 'true');

  const { data, error } = await query;
  if (error) return serverError(res, error);

  const products = (data || []).map(p => ({
    ...p,
    low_stock: Number(p.stock_quantity) < Number(p.min_stock),
  }));

  return ok(res, { products, count: products.length });
});

// POST /api/products
router.post('/', async (req, res) => {
  const { name, category = 'frigobar', price, cost_price = 0, unit = 'un', min_stock = 0 } = req.body;

  if (!name || price === undefined) {
    return fail(res, 'missing_fields', 'name e price são obrigatórios');
  }
  if (!CATEGORIES.includes(category)) {
    return fail(res, 'invalid_category', `category deve ser: ${CATEGORIES.join(', ')}`);
  }

  const { data, error } = await supabaseAdmin
    .from('products')
    .insert({ name, category, price: Number(price), cost_price: Number(cost_price), unit, min_stock: Number(min_stock) })
    .select('*')
    .single();

  if (error) return serverError(res, error);
  return ok(res, { product: data }, 201);
});

// PATCH /api/products/:id
router.patch('/:id', async (req, res) => {
  const updates = {};
  for (const k of EDITABLE) {
    if (req.body[k] !== undefined) updates[k] = req.body[k];
  }
  if (!Object.keys(updates).length) return fail(res, 'no_fields', 'No valid fields to update');
  if (updates.category && !CATEGORIES.includes(updates.category)) {
    return fail(res, 'invalid_category', `category deve ser: ${CATEGORIES.join(', ')}`);
  }
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('products')
    .update(updates)
    .eq('id', req.params.id)
    .select('*')
    .single();

  if (error || !data) return notFound(res, 'Product');
  return ok(res, { product: data });
});

// POST /api/products/:id/stock-entry — entrada de compra (trigger repõe estoque)
router.post('/:id/stock-entry', async (req, res) => {
  const { quantity, unit_cost = 0, note } = req.body;

  if (!quantity || Number(quantity) <= 0) {
    return fail(res, 'invalid_quantity', 'quantity deve ser > 0');
  }

  const { data: product, error: prodErr } = await supabaseAdmin
    .from('products')
    .select('id, name')
    .eq('id', req.params.id)
    .single();

  if (prodErr || !product) return notFound(res, 'Product');

  const { data, error } = await supabaseAdmin
    .from('stock_entries')
    .insert({ product_id: product.id, quantity: Number(quantity), unit_cost: Number(unit_cost), note: note || null })
    .select('*')
    .single();

  if (error) return serverError(res, error);

  const { data: updated } = await supabaseAdmin
    .from('products')
    .select('id, name, stock_quantity, min_stock')
    .eq('id', product.id)
    .single();

  return ok(res, { entry: data, product: updated }, 201);
});

module.exports = router;
