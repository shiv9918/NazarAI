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

/**
 * Reverse geocode coordinates to human-readable address
 * Uses OpenStreetMap Nominatim (free service)
 */
export async function reverseGeocodeCoordinates(
  lat: number,
  lng: number
): Promise<GeocodeResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'NazarAI/1.0',
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      console.error(`[Geocoding] Nominatim error: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as NominatimResponse;

    if (!data.display_name) {
      console.warn(`[Geocoding] No address found for ${lat}, ${lng}`);
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
