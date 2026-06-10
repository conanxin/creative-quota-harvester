/**
 * Open-Meteo Weather Source Adapter — Phase 1 Real Implementation
 * Uses free Open-Meteo API (no API key required)
 */
import { fetchWithTimeout, generateId } from "../utils";
import type { SourceAdapter, SourceRecord, SignalRecord } from "../types";

const WMO_CODES: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Foggy", 48: "Depositing rime fog",
  51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
  56: "Light freezing drizzle", 57: "Dense freezing drizzle",
  61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
  66: "Light freezing rain", 67: "Heavy freezing rain",
  71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
  77: "Snow grains", 80: "Slight rain showers", 81: "Moderate rain showers",
  82: "Violent rain showers", 85: "Slight snow showers", 86: "Heavy snow showers",
  95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail",
};

// Default location: Beijing (39.9, 116.4). Configurable via env
const LAT = Number(process.env.METEO_LAT ?? 39.9);
const LON = Number(process.env.METEO_LON ?? 116.4);
const LOCATION_NAME = process.env.METEO_LOCATION ?? "Beijing";

const DAILY_PARAMS = [
  "weather_code", "temperature_2m_max", "temperature_2m_min",
  "precipitation_sum", "wind_speed_10m_max", "sunrise", "sunset",
].join(",");

export const openMeteoAdapter: SourceAdapter = {
  sourceType: "context",
  sourceName: "Open-Meteo",

  async fetch(_after?: Date): Promise<SourceRecord[]> {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&daily=${DAILY_PARAMS}&timezone=auto&forecast_days=1`;
    const resp = await fetchWithTimeout(url, { timeoutMs: 15000 });

    if (!resp.ok) {
      console.warn(`[open-meteo] API returned ${resp.status}`);
      return [];
    }

    const data = resp.data as Record<string, unknown>;
    const daily = data["daily"] as Record<string, unknown> || {};
    const times = (daily["time"] as string[]) || [];
    const codes = (daily["weather_code"] as number[]) || [];
    const maxTemps = (daily["temperature_2m_max"] as number[]) || [];
    const minTemps = (daily["temperature_2m_min"] as number[]) || [];
    const precips = (daily["precipitation_sum"] as number[]) || [];
    const winds = (daily["wind_speed_10m_max"] as number[]) || [];
    const sunrises = (daily["sunrise"] as string[]) || [];
    const sunsets = (daily["sunset"] as string[]) || [];

    if (!times.length) {
      console.warn("[open-meteo] No daily data returned");
      return [];
    }

    const date = times[0];
    const code = codes[0] ?? 0;
    const maxTemp = maxTemps[0] ?? 0;
    const minTemp = minTemps[0] ?? 0;
    const precip = precips[0] ?? 0;
    const wind = winds[0] ?? 0;
    const weatherDesc = WMO_CODES[code] || `Code ${code}`;

    return [{
      id: generateId("meteo"),
      source: "open-meteo",
      sourceType: this.sourceType,
      url: "",
      fetchedAt: new Date().toISOString(),
      raw: {
        date,
        location: LOCATION_NAME,
        latitude: LAT,
        longitude: LON,
        weatherCode: code,
        weatherDescription: weatherDesc,
        temperatureMax: maxTemp,
        temperatureMin: minTemp,
        precipitationSum: precip,
        windSpeedMax: wind,
        sunrise: sunrises[0] || "",
        sunset: sunsets[0] || "",
      },
    }];
  },

  normalize(record: SourceRecord): SignalRecord[] {
    const raw = record.raw as Record<string, unknown>;
    const date = raw["date"] as string || "";
    const location = raw["location"] as string || LOCATION_NAME;
    const desc = raw["weatherDescription"] as string || "";
    const maxTemp = raw["temperatureMax"] as number;
    const minTemp = raw["temperatureMin"] as number;
    const precip = raw["precipitationSum"] as number;
    const wind = raw["windSpeedMax"] as number;

    return [{
      id: record.id,
      sourceType: record.sourceType,
      sourceId: `open-meteo-${date}`,
      title: `Weather Context: ${location} ${date}`,
      summary: `${desc}, ${minTemp}°C – ${maxTemp}°C, precipitation ${precip}mm, wind ${wind}km/h`,
      url: "",
      publishedAt: date,
      fetchedAt: record.fetchedAt,
      tags: ["weather", "context", location.toLowerCase(), desc.toLowerCase().replace(/\s+/g, "-")],
      metadata: {
        weatherCode: raw["weatherCode"],
        weatherDescription: desc,
        temperatureMax: maxTemp,
        temperatureMin: minTemp,
        precipitationSum: precip,
        windSpeedMax: wind,
        sunrise: raw["sunrise"],
        sunset: raw["sunset"],
        location,
        latitude: LAT,
        longitude: LON,
      },
    }];
  },

  estimatedCallsPerRun() { return 1; },
  cacheTTLMs() { return 24 * 60 * 60 * 1000; }, // 24h
};

export default openMeteoAdapter;