import AsyncStorage from "@react-native-async-storage/async-storage";

export type CachedGif = {
  gifUrl: string;
  gifPreview?: string;
  gifWidth?: number;
  gifHeight?: number;
  gifSource?: "tenor" | "giphy";
  savedAt: number;
};

const STORAGE_KEY = "sent_gifs_cache_v1";
const MAX_ENTRIES = 500;
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

let memoryCache: Record<string, CachedGif> | null = null;

async function loadAll(): Promise<Record<string, CachedGif>> {
  if (memoryCache) return memoryCache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    memoryCache = (parsed && typeof parsed === "object") ? parsed : {};
  } catch {
    memoryCache = {};
  }
  return memoryCache!;
}

async function saveAll(map: Record<string, CachedGif>): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export async function rememberSentGif(
  messageId: string,
  data: Omit<CachedGif, "savedAt">
): Promise<void> {
  if (!messageId || !data?.gifUrl) return;
  const map = await loadAll();
  map[messageId] = { ...data, savedAt: Date.now() };
  const entries = Object.entries(map);
  if (entries.length > MAX_ENTRIES) {
    entries.sort((a, b) => b[1].savedAt - a[1].savedAt);
    const trimmed: Record<string, CachedGif> = {};
    entries.slice(0, MAX_ENTRIES).forEach(([k, v]) => (trimmed[k] = v));
    memoryCache = trimmed;
    await saveAll(trimmed);
    return;
  }
  memoryCache = map;
  await saveAll(map);
}

export async function getCachedGif(messageId: string): Promise<CachedGif | null> {
  if (!messageId) return null;
  const map = await loadAll();
  const entry = map[messageId];
  if (!entry) return null;
  if (Date.now() - entry.savedAt > TTL_MS) return null;
  return entry;
}

export async function getCachedGifsForIds(ids: string[]): Promise<Record<string, CachedGif>> {
  if (!ids?.length) return {};
  const map = await loadAll();
  const out: Record<string, CachedGif> = {};
  const now = Date.now();
  ids.forEach((id) => {
    const entry = map[id];
    if (entry && now - entry.savedAt <= TTL_MS) out[id] = entry;
  });
  return out;
}
