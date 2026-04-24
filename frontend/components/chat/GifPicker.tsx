import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Modal,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  FlatList,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import logger from "@/utils/logger";
import { addRecentGif, clearRecentGifs, getRecentGifs, RecentGif } from "@/utils/recentGifs";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GAP = 6;
const COLUMNS = 2;
const TILE_WIDTH = (SCREEN_WIDTH - GAP * (COLUMNS + 1) - 24) / COLUMNS;

export type GifResult = {
  id: string;
  url: string;
  preview: string;
  width: number;
  height: number;
  title?: string;
  source: "tenor" | "giphy";
};

interface GifPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (gif: GifResult) => void;
}

export default function GifPicker({ visible, onClose, onSelect }: GifPickerProps) {
  const { theme, isDark } = useTheme();
  const { get, post } = useApi();
  const { token } = useAuth();

  const [query, setQuery] = useState("");
  const [items, setItems] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [nextPos, setNextPos] = useState<string | null>(null);
  const [tab, setTab] = useState<"recent" | "trending">("trending");
  const [recents, setRecents] = useState<RecentGif[]>([]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const loadRecents = useCallback(async () => {
    const list = await getRecentGifs();
    setRecents(list);
    return list;
  }, []);

  const load = useCallback(async (q: string, append = false) => {
    if (!token) return;
    const reqId = ++requestIdRef.current;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const path = q.trim()
        ? `/gifs/search?q=${encodeURIComponent(q.trim())}&limit=24${append && nextPos ? `&pos=${encodeURIComponent(nextPos)}` : ""}`
        : `/gifs/trending?limit=24${append && nextPos ? `&pos=${encodeURIComponent(nextPos)}` : ""}`;
      const res = await get<{ items: GifResult[]; next: string | null; code?: string; message?: string }>(path, token);
      if (reqId !== requestIdRef.current) return;
      if (res.success && res.data) {
        setItems((prev) => (append ? [...prev, ...(res.data!.items || [])] : res.data!.items || []));
        setNextPos(res.data.next || null);
        setNotConfigured(false);
      } else {
        if ((res as any)?.data?.code === "NO_KEY" || (res as any)?.code === "NO_KEY") {
          setNotConfigured(true);
        } else {
          setError(res.error || "Couldn't load GIFs");
        }
        if (!append) setItems([]);
      }
    } catch (err: any) {
      if (reqId !== requestIdRef.current) return;
      const msg = err?.message || "";
      if (msg.includes("503") || msg.toLowerCase().includes("not configured")) {
        setNotConfigured(true);
      } else {
        setError("Couldn't load GIFs");
      }
      if (!append) setItems([]);
      logger.error("GifPicker load error:", err);
    } finally {
      if (reqId === requestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [get, token, nextPos]);

  // On open: load recents and pick the best default tab
  useEffect(() => {
    if (!visible) return;
    loadRecents().then((list) => {
      setTab(list.length > 0 ? "recent" : "trending");
    });
  }, [visible, loadRecents]);

  // Initial + debounced search/trending fetch
  useEffect(() => {
    if (!visible) return;
    // Recent tab is local-only — no network
    if (tab === "recent" && !query.trim()) {
      setItems([]);
      setLoading(false);
      setError(null);
      setNotConfigured(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setNextPos(null);
      load(query, false);
    }, query.trim() ? 350 : 0);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, visible, tab]);

  // Reset on close
  useEffect(() => {
    if (!visible) {
      setQuery("");
      setItems([]);
      setError(null);
      setNotConfigured(false);
      setNextPos(null);
    }
  }, [visible]);

  const handleSelect = useCallback((gif: GifResult) => {
    onSelect(gif);
    onClose();
    addRecentGif({
      id: gif.id,
      url: gif.url,
      preview: gif.preview,
      width: gif.width,
      height: gif.height,
      title: gif.title,
      source: gif.source,
    }).catch(() => {});
    if (token) {
      post("/gifs/registershare", { id: gif.id, q: query.trim() }, token).catch(() => {});
    }
  }, [onSelect, onClose, post, token, query]);

  const handleClearRecents = useCallback(async () => {
    await clearRecentGifs();
    setRecents([]);
    setTab("trending");
  }, []);

  // What we render in the grid: search results > recents (if recent tab + no query) > trending
  const gridData: GifResult[] = useMemo(() => {
    if (query.trim()) return items;
    if (tab === "recent") {
      return recents.map((r) => ({
        id: r.id,
        url: r.url,
        preview: r.preview,
        width: r.width,
        height: r.height,
        title: r.title,
        source: r.source,
      }));
    }
    return items;
  }, [query, tab, items, recents]);

  const renderItem = useCallback(({ item }: { item: GifResult }) => {
    const aspect = item.width && item.height ? item.width / item.height : 1;
    const tileHeight = Math.max(80, Math.min(220, TILE_WIDTH / aspect));
    return (
      <Pressable
        style={[styles.tile, { width: TILE_WIDTH, height: tileHeight, backgroundColor: theme.border + "40" }]}
        onPress={() => handleSelect(item)}
      >
        <Image
          source={{ uri: item.preview }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          transition={150}
        />
      </Pressable>
    );
  }, [handleSelect, theme.border]);

  const keyExtractor = useCallback((item: GifResult) => item.id, []);

  const emptyContent = useMemo(() => {
    if (loading) return null;
    if (notConfigured) {
      return (
        <View style={styles.empty}>
          <Feather name="alert-circle" size={36} color={theme.textSecondary} />
          <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>GIFs aren't configured yet</ThemedText>
          <ThemedText style={[styles.emptySub, { color: theme.textSecondary }]}>
            Add a Giphy or Tenor API key on the server to enable the GIF picker.
          </ThemedText>
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.empty}>
          <Feather name="cloud-off" size={36} color={theme.textSecondary} />
          <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>{error}</ThemedText>
          <Pressable
            onPress={() => { setNextPos(null); load(query, false); }}
            style={[styles.retryBtn, { backgroundColor: theme.primary }]}
          >
            <ThemedText style={styles.retryText}>Try again</ThemedText>
          </Pressable>
        </View>
      );
    }
    if (!query.trim() && tab === "recent" && recents.length === 0) {
      return (
        <View style={styles.empty}>
          <Feather name="clock" size={36} color={theme.textSecondary} />
          <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>No recent GIFs yet</ThemedText>
          <ThemedText style={[styles.emptySub, { color: theme.textSecondary }]}>
            GIFs you send will appear here for quick reuse.
          </ThemedText>
        </View>
      );
    }
    if (!gridData.length) {
      return (
        <View style={styles.empty}>
          <Feather name="search" size={36} color={theme.textSecondary} />
          <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>No GIFs found</ThemedText>
          <ThemedText style={[styles.emptySub, { color: theme.textSecondary }]}>Try a different search</ThemedText>
        </View>
      );
    }
    return null;
  }, [loading, notConfigured, error, gridData.length, theme, load, query, tab, recents.length]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.background }]}>
          <View style={[styles.handle, { backgroundColor: theme.textSecondary + "55" }]} />
          <View style={styles.header}>
            <ThemedText style={[styles.title, { color: theme.text }]}>Send a GIF</ThemedText>
            <View style={[styles.poweredBy, { backgroundColor: isDark ? "#FFFFFF15" : "#00000008" }]}>
              <ThemedText style={[styles.poweredByText, { color: theme.textSecondary }]}>via Tenor</ThemedText>
            </View>
          </View>

          <View style={[styles.searchRow, { backgroundColor: theme.border + "40", borderColor: theme.border }]}>
            <Feather name="search" size={16} color={theme.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search GIFs"
              placeholderTextColor={theme.textSecondary}
              style={[styles.searchInput, { color: theme.text }]}
              returnKeyType="search"
              autoCorrect={false}
            />
            {!!query && (
              <Pressable onPress={() => setQuery("")} hitSlop={10}>
                <Feather name="x" size={16} color={theme.textSecondary} />
              </Pressable>
            )}
          </View>

          {/* Tab toggle (hidden when searching) */}
          {!query.trim() && (
            <View style={styles.tabsRow}>
              {(["recent", "trending"] as const).map((t) => {
                const isActive = tab === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setTab(t)}
                    style={[
                      styles.tabPill,
                      {
                        backgroundColor: isActive ? theme.primary : theme.border + "40",
                        borderColor: isActive ? theme.primary : "transparent",
                      },
                    ]}
                  >
                    <Feather
                      name={t === "recent" ? "clock" : "trending-up"}
                      size={12}
                      color={isActive ? "#FFF" : theme.textSecondary}
                    />
                    <ThemedText
                      style={[
                        styles.tabPillText,
                        { color: isActive ? "#FFF" : theme.textSecondary },
                      ]}
                    >
                      {t === "recent" ? "Recent" : "Trending"}
                    </ThemedText>
                  </Pressable>
                );
              })}
              {tab === "recent" && recents.length > 0 && (
                <Pressable onPress={handleClearRecents} hitSlop={10} style={{ marginLeft: "auto" }}>
                  <ThemedText style={[styles.clearText, { color: theme.textSecondary }]}>Clear</ThemedText>
                </Pressable>
              )}
            </View>
          )}

          {loading && gridData.length === 0 ? (
            <View style={styles.empty}>
              <ActivityIndicator color={theme.primary} />
            </View>
          ) : (
            <FlatList
              data={gridData}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              numColumns={COLUMNS}
              columnWrapperStyle={{ gap: GAP, paddingHorizontal: 12 }}
              contentContainerStyle={{ gap: GAP, paddingTop: 4, paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={emptyContent}
              onEndReachedThreshold={0.4}
              onEndReached={() => {
                // Only paginate for network-backed lists (search or trending)
                const isNetworkList = !!query.trim() || tab === "trending";
                if (isNetworkList && !loadingMore && nextPos && gridData.length > 0) {
                  load(query, true);
                }
              }}
              ListFooterComponent={
                loadingMore ? (
                  <View style={{ paddingVertical: 16 }}>
                    <ActivityIndicator color={theme.primary} />
                  </View>
                ) : null
              }
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    height: "75%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    overflow: "hidden",
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginVertical: 8 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 17, fontWeight: "700" },
  poweredBy: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  poweredByText: { fontSize: 10, fontWeight: "600" },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  tabsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  tabPillText: { fontSize: 11, fontWeight: "700" },
  clearText: { fontSize: 11, fontWeight: "600" },
  tile: { borderRadius: 10, overflow: "hidden" },
  empty: { paddingVertical: 60, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 14, fontWeight: "600", textAlign: "center" },
  emptySub: { fontSize: 12, textAlign: "center", lineHeight: 18 },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, marginTop: 6 },
  retryText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
});
