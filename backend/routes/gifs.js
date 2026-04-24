const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const logger = require('../utils/logger');

const TENOR_BASE = 'https://tenor.googleapis.com/v2';
const GIPHY_BASE = 'https://api.giphy.com/v1/gifs';

const hasGiphy = () => !!process.env.GIPHY_API_KEY;
const hasTenor = () => !!process.env.TENOR_API_KEY;
const activeProvider = () => (hasGiphy() ? 'giphy' : (hasTenor() ? 'tenor' : null));

// ─── Tenor ───────────────────────────────────────────────────────────────────
const fetchTenor = async (endpoint, params = {}) => {
  const url = new URL(`${TENOR_BASE}/${endpoint}`);
  url.searchParams.set('key', process.env.TENOR_API_KEY);
  url.searchParams.set('client_key', process.env.TENOR_CLIENT_KEY || 'afroconnect_chat');
  url.searchParams.set('contentfilter', 'high');
  url.searchParams.set('media_filter', 'gif,tinygif');
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(url.toString(), { signal: controller.signal });
    if (!r.ok) throw new Error(`Tenor ${endpoint} returned ${r.status}`);
    return await r.json();
  } finally { clearTimeout(timer); }
};

const normalizeTenor = (data) => {
  const items = (data?.results || []).map((r) => {
    const gif = r.media_formats?.gif;
    const tiny = r.media_formats?.tinygif;
    if (!gif?.url) return null;
    const [w, h] = gif.dims || [0, 0];
    return {
      id: r.id,
      url: gif.url,
      preview: tiny?.url || gif.url,
      width: w,
      height: h,
      title: r.content_description || r.title || '',
      source: 'tenor',
    };
  }).filter(Boolean);
  return { items, next: data?.next || null };
};

// ─── Giphy ───────────────────────────────────────────────────────────────────
const fetchGiphy = async (endpoint, params = {}) => {
  const url = new URL(`${GIPHY_BASE}/${endpoint}`);
  url.searchParams.set('api_key', process.env.GIPHY_API_KEY);
  url.searchParams.set('rating', 'g');
  url.searchParams.set('bundle', 'messaging_non_clips');
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(url.toString(), { signal: controller.signal });
    if (!r.ok) throw new Error(`Giphy ${endpoint} returned ${r.status}`);
    return await r.json();
  } finally { clearTimeout(timer); }
};

const normalizeGiphy = (data) => {
  const items = (data?.data || []).map((d) => {
    const orig = d.images?.original;
    const small = d.images?.fixed_width || d.images?.fixed_width_small || d.images?.downsized_medium;
    if (!orig?.url) return null;
    return {
      id: d.id,
      url: orig.url,
      preview: small?.url || orig.url,
      width: parseInt(orig.width) || 0,
      height: parseInt(orig.height) || 0,
      title: d.title || '',
      source: 'giphy',
    };
  }).filter(Boolean);
  const offset = (data?.pagination?.offset || 0) + (data?.pagination?.count || 0);
  const totalCount = data?.pagination?.total_count || 0;
  const next = totalCount && offset < totalCount ? String(offset) : null;
  return { items, next };
};

// ─── Provider dispatcher ─────────────────────────────────────────────────────
const noKeyResponse = (res) =>
  res.status(503).json({ success: false, code: 'NO_KEY', message: 'GIF service not configured' });

const handleTrending = async (req, res) => {
  const provider = activeProvider();
  if (!provider) return noKeyResponse(res);
  try {
    const limit = Math.min(50, parseInt(req.query.limit) || 24);
    const pos = req.query.pos;
    if (provider === 'giphy') {
      const data = await fetchGiphy('trending', { limit, offset: pos || undefined });
      return res.json({ success: true, ...normalizeGiphy(data), provider });
    }
    const data = await fetchTenor('featured', { limit, pos: pos || undefined });
    return res.json({ success: true, ...normalizeTenor(data), provider });
  } catch (error) {
    logger.error(`GIF trending (${provider}) error:`, error.message);
    res.status(502).json({ success: false, message: 'Failed to load trending GIFs' });
  }
};

const handleSearch = async (req, res) => {
  const provider = activeProvider();
  if (!provider) return noKeyResponse(res);
  const q = String(req.query.q || '').trim();
  if (!q) return res.status(400).json({ success: false, message: 'Query required' });
  try {
    const limit = Math.min(50, parseInt(req.query.limit) || 24);
    const pos = req.query.pos;
    const safeQ = q.slice(0, 80);
    if (provider === 'giphy') {
      const data = await fetchGiphy('search', { q: safeQ, limit, offset: pos || undefined });
      return res.json({ success: true, ...normalizeGiphy(data), provider });
    }
    const data = await fetchTenor('search', { q: safeQ, limit, pos: pos || undefined });
    return res.json({ success: true, ...normalizeTenor(data), provider });
  } catch (error) {
    logger.error(`GIF search (${provider}) error:`, error.message);
    res.status(502).json({ success: false, message: 'Failed to search GIFs' });
  }
};

router.get('/trending', protect, handleTrending);
router.get('/search', protect, handleSearch);

router.get('/status', protect, (req, res) => {
  res.json({ success: true, provider: activeProvider() });
});

// Best-effort share registration (Tenor only — Giphy has no equivalent endpoint)
router.post('/registershare', protect, async (req, res) => {
  try {
    if (activeProvider() === 'tenor' && req.body?.id) {
      fetchTenor('registershare', { id: req.body.id, q: req.body.q || '' }).catch(() => {});
    }
    res.json({ success: true });
  } catch {
    res.json({ success: true });
  }
});

module.exports = router;
