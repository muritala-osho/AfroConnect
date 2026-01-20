import React from 'react';
import { Image as ExpoImage, ImageProps as ExpoImageProps } from 'expo-image';
import { View } from 'react-native';

interface SafeImageProps extends Omit<ExpoImageProps, 'source'> {
  source?: any;
}

function normalizeImageSource(source: any): any {
  if (!source) return null;
  
  // Handle: number (require() result)
  if (typeof source === 'number') return source;
  
  // Handle: string URI
  if (typeof source === 'string') {
    return { uri: source };
  }
  
  // Handle: { uri: string }
  if (typeof source === 'object' && source.uri && typeof source.uri === 'string') {
    return source;
  }
  
  // Handle: { uri: { url: string } } - nested object case
  if (typeof source === 'object' && source.uri && typeof source.uri === 'object') {
    if (source.uri.url && typeof source.uri.url === 'string') {
      return { uri: source.uri.url };
    }
  }
  
  // Handle: { url: string }
  if (typeof source === 'object' && source.url && typeof source.url === 'string') {
    return { uri: source.url };
  }
  
  // Handle: { publicId: string } - Cloudinary pattern
  if (typeof source === 'object' && source.publicId && !source.uri && !source.url) {
    // Return null or a placeholder - don't try to use incomplete data
    return null;
  }
  
  // Handle: arrays (sometimes passed as multiple sources)
  if (Array.isArray(source) && source.length > 0) {
    return normalizeImageSource(source[0]);
  }
  
  // Fallback - return as-is and let Expo handle it
  // This prevents crashing on unknown formats
  return null;
}

/**
 * SafeImage is a wrapper around expo-image that safely handles various source formats
 * and prevents "Cannot set prop 'source'" errors by normalizing image sources.
 */
export const SafeImage = React.forwardRef<any, SafeImageProps>(
  ({ source, ...props }, ref) => {
    const normalizedSource = normalizeImageSource(source);
    
    // Don't render anything if source is invalid
    if (!normalizedSource) {
      return <View {...(props as any)} />;
    }
    
    return (
      <ExpoImage
        ref={ref}
        source={normalizedSource}
        style={[{ backgroundColor: 'transparent' }, props.style]}
        {...props}
      />
    );
  }
);

SafeImage.displayName = 'SafeImage';
