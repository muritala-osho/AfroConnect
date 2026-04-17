export const FALLBACK_COUNTRIES = [
  'Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Tanzania', 'Uganda',
  'Ethiopia', 'Cameroon', 'Senegal', 'Ivory Coast', 'Zimbabwe',
  'USA', 'UK', 'Canada', 'France', 'Germany', 'Brazil', 'India',
  'Australia', 'UAE', 'Japan', 'Netherlands', 'Italy', 'Spain',
];

export const PASSPORT_CITIES = [
  { name: 'New York', lat: 40.7128, lng: -74.0060, country: 'USA' },
  { name: 'London', lat: 51.5074, lng: -0.1278, country: 'UK' },
  { name: 'Paris', lat: 48.8566, lng: 2.3522, country: 'France' },
  { name: 'Lagos', lat: 6.5244, lng: 3.3792, country: 'Nigeria' },
  { name: 'Nairobi', lat: -1.2921, lng: 36.8219, country: 'Kenya' },
  { name: 'Tokyo', lat: 35.6762, lng: 139.6503, country: 'Japan' },
  { name: 'Dubai', lat: 25.2048, lng: 55.2708, country: 'UAE' },
  { name: 'São Paulo', lat: -23.5505, lng: -46.6333, country: 'Brazil' },
  { name: 'Johannesburg', lat: -26.2041, lng: 28.0473, country: 'South Africa' },
  { name: 'Accra', lat: 5.6037, lng: -0.1870, country: 'Ghana' },
];

export interface DiscoverUser {
  id: string;
  name: string;
  age: number | null;
  livingIn?: string;
  bio: string;
  photos: any[];
  interests: string[];
  online: boolean | null;
  distance: number | null;
  similarityScore?: number;
  gender?: string;
  verified?: boolean;
  location?: {
    city?: string;
    state?: string;
  };
  religion?: string;
  personalityType?: string;
  needsVerification?: boolean;
  premium?: { isActive: boolean };
}
