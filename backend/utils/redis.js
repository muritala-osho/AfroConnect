const Redis = require('ioredis');

let client = null;
let isConnected = false;

function getClient() {
  if (client) return client;

  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.log('[Redis] REDIS_URL not set — caching disabled');
    return null;
  }

  try {
    client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
      connectTimeout: 5000,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 500, 2000);
      },
    });

    client.on('connect', () => {
      isConnected = true;
      console.log('[Redis] Connected');
    });

    client.on('error', (err) => {
      isConnected = false;
      console.warn('[Redis] Error:', err.message);
    });

    client.on('close', () => {
      isConnected = false;
    });

    client.connect().catch(() => {});
  } catch (err) {
    console.warn('[Redis] Failed to initialize:', err.message);
    client = null;
  }

  return client;
}

async function get(key) {
  try {
    const c = getClient();
    if (!c) return null;
    const val = await c.get(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

async function set(key, value, ttlSeconds = 60) {
  try {
    const c = getClient();
    if (!c) return;
    await c.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {}
}

async function del(key) {
  try {
    const c = getClient();
    if (!c) return;
    await c.del(key);
  } catch {}
}

async function delPattern(pattern) {
  try {
    const c = getClient();
    if (!c) return;
    let cursor = '0';
    const batchSize = 100;
    do {
      const [nextCursor, keys] = await c.scan(cursor, 'MATCH', pattern, 'COUNT', batchSize);
      cursor = nextCursor;
      if (keys.length > 0) {
        await c.del(...keys);
      }
    } while (cursor !== '0');
  } catch {}
}

module.exports = { getClient, get, set, del, delPattern };
