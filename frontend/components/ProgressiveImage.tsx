
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
  
  // If it's already a proper format, return it
  if (typeof source === 'number' || typeof source === 'string') return source;
  
  // If it's an object with uri property, extract it
  if (typeof source === 'object' && source.uri) {
    // Make sure uri is a string, not a nested object
    if (typeof source.uri === 'string') {
      return { uri: source.uri };
    }
    // If uri is an object, try to extract its url property
    if (typeof source.uri === 'object' && source.uri.url) {
      return { uri: source.uri.url };
    }
  }
  
  // If it's an object with url property, wrap it
  if (typeof source === 'object' && source.url && typeof source.url === 'string') {
    return { uri: source.url };
  }
  
  return source;
}

export function ProgressiveImage({ source, style, contentFit = "cover" }: ProgressiveImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const normalizedSource = normalizeSource(source);

  // Don't render if source is invalid
  if (!normalizedSource) {
    return <View style={style as any} />;
  }

  return (
    <View style={style as any}>
      {isLoading && <Skeleton width="100%" height="100%" style={StyleSheet.absoluteFill} />}
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
