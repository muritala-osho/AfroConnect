
import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { SafeImage } from "@/components/SafeImage";
import { Skeleton } from "@/components/SkeletonLoader";

interface ProgressiveImageProps {
  source: any;
  style?: any;
  contentFit?: "cover" | "contain" | "fill" | "none" | "scale-down";
}

function normalizeSource(source: any): any {
  if (!source) return null;
  
  if (typeof source === 'number' || typeof source === 'string') return source;
  
  if (typeof source === 'object' && source.uri) {
    if (typeof source.uri === 'string') {
      return { uri: source.uri };
    }
    if (typeof source.uri === 'object' && source.uri.url) {
      return { uri: source.uri.url };
    }
  }
  
  if (typeof source === 'object' && source.url && typeof source.url === 'string') {
    return { uri: source.url };
  }
  
  return source;
}

export function ProgressiveImage({ source, style, contentFit = "cover" }: ProgressiveImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const normalizedSource = normalizeSource(source);

  if (!normalizedSource) {
    return <View style={style as any} />;
  }

  return (
    <View style={style as any}>
      {isLoading && <Skeleton style={StyleSheet.absoluteFill} />}
      <SafeImage
        source={normalizedSource}
        style={[StyleSheet.absoluteFill, { opacity: isLoading ? 0 : 1 }]}
        contentFit={contentFit}
        transition={300}
        onLoadEnd={() => setIsLoading(false)}
      />
    </View>
  );
}
