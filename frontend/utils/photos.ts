export const PHOTO_PLACEHOLDERS = {
  "placeholder-1": require("@/assets/images/placeholder-1.jpg"),
  "placeholder-2": require("@/assets/images/placeholder-2.jpg"),
  "placeholder-3": require("@/assets/images/placeholder-3.jpg"),
  "placeholder-4": require("@/assets/images/placeholder-4.jpg"),
  "placeholder-5": require("@/assets/images/placeholder-5.jpg"),
  "placeholder-6": require("@/assets/images/placeholder-6.jpg"),
  "placeholder-7": require("@/assets/images/placeholder-7.jpg"),
  "placeholder-8": require("@/assets/images/placeholder-8.jpg"),
};

export const PHOTO_PLACEHOLDER_ARRAY = [
  { id: "placeholder-1", source: require("@/assets/images/placeholder-1.jpg") },
  { id: "placeholder-2", source: require("@/assets/images/placeholder-2.jpg") },
  { id: "placeholder-3", source: require("@/assets/images/placeholder-3.jpg") },
  { id: "placeholder-4", source: require("@/assets/images/placeholder-4.jpg") },
  { id: "placeholder-5", source: require("@/assets/images/placeholder-5.jpg") },
  { id: "placeholder-6", source: require("@/assets/images/placeholder-6.jpg") },
  { id: "placeholder-7", source: require("@/assets/images/placeholder-7.jpg") },
  { id: "placeholder-8", source: require("@/assets/images/placeholder-8.jpg") },
];

interface PhotoObject {
  url?: string;
  publicId?: string;
  isPrimary?: boolean;
  privacy?: string;
  order?: number;
}

export function getPhotoSource(photo: string | PhotoObject | null | undefined): { uri: string } | number | null {
  if (!photo) return null;
  
  if (typeof photo === 'string') {
    if (photo.startsWith('http://') || photo.startsWith('https://')) {
      return { uri: photo };
    }
    return PHOTO_PLACEHOLDERS[photo as keyof typeof PHOTO_PLACEHOLDERS] || null;
  }
  
  if (typeof photo === 'object' && photo.url) {
    if (photo.url.startsWith('http://') || photo.url.startsWith('https://')) {
      return { uri: photo.url };
    }
    return PHOTO_PLACEHOLDERS[photo.url as keyof typeof PHOTO_PLACEHOLDERS] || null;
  }
  
  return null;
}
