// Default fallback location used only when live geolocation cannot be obtained.
export const DEFAULT_FALLBACK_LOCATION = {
  lat: 26.73056,
  lng: 83.43333,
  address: "Madan Mohan Malaviya University of Technology, Gorakhpur, Uttar Pradesh, India",
};

export async function getAddressFromCoords(lat: number, lng: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'CivicEye-App'
        }
      }
    );
    const data = await response.json();
    return data.display_name || "Unknown Location";
  } catch (error) {
    console.error("Error reverse geocoding:", error);
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

function describeGeolocationError(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location permission denied. Please allow location access in your browser settings.";
    case error.POSITION_UNAVAILABLE:
      return "Location information is unavailable. Please check your device's GPS/network connection.";
    case error.TIMEOUT:
      return "Location request timed out.";
    default:
      return "Unable to fetch your current location.";
  }
}

export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => {
        // First attempt (high accuracy) failed - retry once with relaxed
        // accuracy/timeout before giving up, since many desktop/indoor
        // environments fail fast on high-accuracy GPS requests.
        navigator.geolocation.getCurrentPosition(
          resolve,
          (retryError) => reject(new Error(describeGeolocationError(retryError))),
          {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 60000
          }
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0
      }
    );
  });
}
