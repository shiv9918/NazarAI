import { env } from '../config/env';
import { reverseGeocodeCoordinates } from './geocodingService';

export type RainfallSeverity = 'none' | 'watch' | 'warning' | 'emergency';

export type WeatherSummary = {
  city: string;
  rainfall48hMm: number;
  generatedAt: string;
  severity: RainfallSeverity;
  label: string;
  bannerText: string;
  source: string;
};

export type WeatherProviderResult = {
  weather: WeatherSummary;
  provider: 'OpenWeatherMap' | 'OpenMeteoFallback';
  providerWarning?: string;
};

type OpenWeatherForecastItem = {
  dt: number;
  rain?: {
    ['3h']?: number;
  };
};

type OpenWeatherForecastResponse = {
  list?: OpenWeatherForecastItem[];
  city?: {
    name?: string;
  };
  message?: string;
  cod?: string;
};

const OPEN_WEATHER_ENDPOINT = 'https://api.openweathermap.org/data/2.5/forecast';
const OPEN_METEO_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

async function getLocationNameFromApi(): Promise<string> {
  const geocoded = await reverseGeocodeCoordinates(env.openWeatherLat, env.openWeatherLon);
  if (!geocoded) {
    return `${env.openWeatherLat.toFixed(3)}, ${env.openWeatherLon.toFixed(3)}`;
  }

  return geocoded.city !== 'Unknown' ? geocoded.city : geocoded.address;
}

export function classifyRainfall(rainfall48hMm: number): {
  severity: RainfallSeverity;
  label: string;
  bannerText: string;
} {
  if (rainfall48hMm < 20) {
    return {
      severity: 'none',
      label: 'No alert',
      bannerText: 'No alert, green status. Teams stay on normal readiness.',
    };
  }

  if (rainfall48hMm < 40) {
    return {
      severity: 'watch',
      label: 'Blue Watch',
      bannerText: 'Rain watch issued. Keep field teams on standby.',
    };
  }

  if (rainfall48hMm < 75) {
    return {
      severity: 'warning',
      label: 'Yellow Warning',
      bannerText: 'Heavy rain warning. Pre-deploy teams in vulnerable areas.',
    };
  }

  return {
    severity: 'emergency',
    label: 'Red Emergency',
    bannerText: 'Extreme rainfall risk. Immediate pre-deployment is required.',
  };
}

export async function getOpenWeather48hSummary(): Promise<WeatherSummary> {
  if (!env.openWeatherApiKey) {
    throw new Error('OPENWEATHER_API_KEY is not configured.');
  }

  const url = new URL(OPEN_WEATHER_ENDPOINT);
  url.searchParams.set('lat', String(env.openWeatherLat));
  url.searchParams.set('lon', String(env.openWeatherLon));
  url.searchParams.set('appid', env.openWeatherApiKey);
  url.searchParams.set('units', 'metric');

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(7000),
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => ({}))) as OpenWeatherForecastResponse;
    const providerMessage = errorPayload?.message ? ` ${errorPayload.message}` : '';
    throw new Error(`OpenWeatherMap request failed with status ${response.status}.${providerMessage}`);
  }

  const payload = (await response.json()) as OpenWeatherForecastResponse;
  const slots = Array.isArray(payload.list) ? payload.list.slice(0, 16) : [];

  const rainfall48hMm = slots.reduce((sum, item) => {
    const rainfall = item.rain?.['3h'] ?? 0;
    return sum + (Number.isFinite(rainfall) ? rainfall : 0);
  }, 0);

  const rounded = Math.round(rainfall48hMm * 10) / 10;
  const classification = classifyRainfall(rounded);
  const cityName = payload.city?.name || (await getLocationNameFromApi());

  return {
    city: cityName,
    rainfall48hMm: rounded,
    generatedAt: new Date().toISOString(),
    source: 'OpenWeatherMap',
    severity: classification.severity,
    label: classification.label,
    bannerText: classification.bannerText,
  };
}

type OpenMeteoForecastResponse = {
  hourly?: {
    precipitation?: number[];
  };
};

async function getOpenMeteo48hFallback(): Promise<WeatherSummary> {
  const url = new URL(OPEN_METEO_ENDPOINT);
  url.searchParams.set('latitude', String(env.openWeatherLat));
  url.searchParams.set('longitude', String(env.openWeatherLon));
  url.searchParams.set('hourly', 'precipitation');
  url.searchParams.set('forecast_days', '3');
  url.searchParams.set('timezone', 'UTC');

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(7000),
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo fallback failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as OpenMeteoForecastResponse;
  const hourlyRain = Array.isArray(payload.hourly?.precipitation) ? payload.hourly!.precipitation! : [];
  const first48 = hourlyRain.slice(0, 48);
  const rainfall48hMm = first48.reduce((sum, value) => sum + (Number.isFinite(value) ? Number(value) : 0), 0);
  const rounded = Math.round(rainfall48hMm * 10) / 10;
  const classification = classifyRainfall(rounded);
  const cityName = await getLocationNameFromApi();

  return {
    city: cityName,
    rainfall48hMm: rounded,
    generatedAt: new Date().toISOString(),
    source: 'OpenMeteoFallback',
    severity: classification.severity,
    label: classification.label,
    bannerText: classification.bannerText,
  };
}

export async function getWeather48hSummary(): Promise<WeatherProviderResult> {
  try {
    const weather = await getOpenWeather48hSummary();
    return {
      weather,
      provider: 'OpenWeatherMap',
    };
  } catch (owmError) {
    const fallbackWeather = await getOpenMeteo48hFallback();
    return {
      weather: fallbackWeather,
      provider: 'OpenMeteoFallback',
      providerWarning: owmError instanceof Error ? owmError.message : 'OpenWeatherMap unavailable',
    };
  }
}
