/**
 * Reverse geocoding service to convert latitude/longitude to addresses
 * Uses OpenStreetMap Nominatim API (free, no API key needed)
 */

export interface GeocodeResult {
  address: string;
  city: string;
  district: string;
  state: string;
  country: string;
}

interface NominatimResponse {
  display_name: string;
  address?: {
    road?: string;
    suburb?: string;
    city?: string;
    district?: string;
    state?: string;
    country?: string;
  };
}

interface BigDataCloudResponse {
  locality?: string;
  city?: string;
  principalSubdivision?: string;
  countryName?: string;
  postcode?: string;
}

async function reverseWithNominatim(lat: number, lng: number): Promise<GeocodeResult | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'NazarAI/1.0',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    console.warn(`[Geocoding] Nominatim unavailable: ${response.status}`);
    return null;
  }

  const data = (await response.json()) as NominatimResponse;
  if (!data.display_name) {
    return null;
  }

  const addr = data.address || {};
  return {
    address: data.display_name,
    city: addr.city || addr.suburb || 'Unknown',
    district: addr.district || 'Unknown',
    state: addr.state || 'Unknown',
    country: addr.country || 'Unknown',
  };
}

async function reverseWithBigDataCloud(lat: number, lng: number): Promise<GeocodeResult | null> {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    console.warn(`[Geocoding] BigDataCloud unavailable: ${response.status}`);
    return null;
  }

  const data = (await response.json()) as BigDataCloudResponse;
  const city = data.city || data.locality;
  const state = data.principalSubdivision;
  const country = data.countryName;

  if (!city && !state && !country) {
    return null;
  }

  const pieces = [city, state, country].filter(Boolean);
  const address = pieces.join(', ');

  return {
    address,
    city: city || 'Unknown',
    district: city || 'Unknown',
    state: state || 'Unknown',
    country: country || 'Unknown',
  };
}

/**
 * Reverse geocode coordinates to human-readable address
 * Uses OpenStreetMap Nominatim (free service)
 */
export async function reverseGeocodeCoordinates(
  lat: number,
  lng: number
): Promise<GeocodeResult | null> {
  try {
    const primary = await reverseWithNominatim(lat, lng);
    if (primary) {
      return primary;
    }

    const fallback = await reverseWithBigDataCloud(lat, lng);
    if (fallback) {
      return fallback;
    }

    console.warn(`[Geocoding] No address resolved from providers for ${lat}, ${lng}`);
    return null;
  } catch (error) {
    console.error(`[Geocoding] Reverse geocoding failed:`, error);
    return null;
  }
}

/**
 * Format geocoding result as user-friendly text
 */
export function formatGeocodeResult(result: GeocodeResult): string {
  const parts = [result.address];
  if (result.district && result.district !== 'Unknown') {
    parts.push(`District: ${result.district}`);
  }
  if (result.state && result.state !== 'Unknown') {
    parts.push(`State: ${result.state}`);
  }
  return parts.join('\n');
}
