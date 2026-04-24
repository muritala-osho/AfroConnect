import AsyncStorage from "@react-native-async-storage/async-storage";

export type RecentGif = {
  id: string;
  url: string;
  preview: string;
  width: number;
  height: number;
  title?: string;
  source: "tenor" | "giphy";
  usedAt: number;
};

const STORAGE_KEY = "recent_gifs_v1";
const MAX_RECENTS = 24;

export async function getRecentGifs(): Promise<RecentGif[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((g) => g && typeof g.id === "string" && typeof g.url === "string")
      .slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

export async function addRecentGif(gif: Omit<RecentGif, "usedAt">): Promise<void> {
  try {
    const current = await getRecentGifs();
    const without = current.filter((g) => g.id !== gif.id);
    const next: RecentGif[] = [
      { ...gif, usedAt: Date.now() },
      ...without,
    ].slice(0, MAX_RECENTS);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // best-effort; never block sending on storage errors
  }
}

export async function clearRecentGifs(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
