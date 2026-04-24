const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const logger = require('../utils/logger');

const TENOR_BASE = 'https://tenor.googleapis.com/v2';

const buildKey = () => {
  const key = process.env.TENOR_API_KEY;
  if (!key) return null;
  return key;
};

const buildClientKey = () => process.env.TENOR_CLIENT_KEY || 'afroconnect_chat';

const fetchTenor = async (endpoint, params = {}) => {
  const key = buildKey();
  if (!key) {
    const err = new Error('GIF service not configured');
    err.code = 'NO_KEY';
    throw err;
  }
  const url = new URL(`${TENOR_BASE}/${endpoint}`);
  url.searchParams.set('key', key);
  url.searchParams.set('client_key', buildClientKey());
  url.searchParams.set('contentfilter', 'high');
  url.searchParams.set('media_filter', 'gif,tinygif');
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Tenor ${endpoint} returned ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
};

const normalize = (data) => {
  const results = Array.isArray(data?.results) ? data.results : [];
  const items = results.map((r) => {
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

router.get('/trending', protect, async (req, res) => {
  try {
    const { limit = 24, pos } = req.query;
    const data = await fetchTenor('featured', {
      limit: Math.min(50, parseInt(limit) || 24),
      pos: pos || undefined,
    });
    res.json({ success: true, ...normalize(data) });
  } catch (error) {
    if (error.code === 'NO_KEY') {
      return res.status(503).json({ success: false, code: 'NO_KEY', message: 'GIF service not configured' });
    }
    logger.error('Tenor trending error:', error.message);
    res.status(502).json({ success: false, message: 'Failed to load trending GIFs' });
  }
});

router.get('/search', protect, async (req, res) => {
  try {
    const { q, limit = 24, pos } = req.query;
    if (!q || !String(q).trim()) {
      return res.status(400).json({ success: false, message: 'Query required' });
    }
    const data = await fetchTenor('search', {
      q: String(q).trim().slice(0, 80),
      limit: Math.min(50, parseInt(limit) || 24),
      pos: pos || undefined,
    });
    res.json({ success: true, ...normalize(data) });
  } catch (error) {
    if (error.code === 'NO_KEY') {
      return res.status(503).json({ success: false, code: 'NO_KEY', message: 'GIF service not configured' });
    }
    logger.error('Tenor search error:', error.message);
    res.status(502).json({ success: false, message: 'Failed to search GIFs' });
  }
});

router.get('/categories', protect, async (req, res) => {
  try {
    const data = await fetchTenor('categories', { type: 'featured' });
    const tags = Array.isArray(data?.tags) ? data.tags : [];
    res.json({
      success: true,
      categories: tags.map((t) => ({
        name: t.name,
        searchterm: t.searchterm,
        image: t.image,
      })),
    });
  } catch (error) {
    if (error.code === 'NO_KEY') {
      return res.status(503).json({ success: false, code: 'NO_KEY', message: 'GIF service not configured' });
    }
    logger.error('Tenor categories error:', error.message);
    res.status(502).json({ success: false, message: 'Failed to load categories' });
  }
});

// Optional registration ping — Tenor recommends calling this when a user "shares"
// a GIF so it floats up in trending. Best-effort, never blocks the user.
router.post('/registershare', protect, async (req, res) => {
  try {
    const { id, q } = req.body || {};
    if (!id) return res.json({ success: true });
    fetchTenor('registershare', { id, q: q || '' }).catch(() => {});
    res.json({ success: true });
  } catch {
    res.json({ success: true });
  }
});

module.exports = router;
