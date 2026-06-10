/**
 * Solar Terms Source Adapter — Phase 1 Real Implementation
 * Embedded calculation, no external API call needed
 */
import { generateId } from "../utils";
import type { SourceAdapter, SourceRecord, SignalRecord } from "../types";

// 24 solar terms (jieqi) with approximate dates
const SOLAR_TERMS: Array<{
  name: string; nameCn: string; month: number; approxDay: number;
  season: string; description: string;
}> = [
  { name: "Start of Spring", nameCn: "立春", month: 2, approxDay: 4,
    season: "spring", description: "Beginning of spring, traditional Chinese New Year period" },
  { name: "Rain Water", nameCn: "雨水", month: 2, approxDay: 19,
    season: "spring", description: "Rain water, significant for agriculture" },
  { name: "Insects Awakening", nameCn: "惊蛰", month: 3, approxDay: 6,
    season: "spring", description: "Insects awaken from hibernation" },
  { name: "Spring Equinox", nameCn: "春分", month: 3, approxDay: 21,
    season: "spring", description: "Spring equinox, day and night equal" },
  { name: "Clear and Bright", nameCn: "清明", month: 4, approxDay: 5,
    season: "spring", description: "Clear and bright, tomb sweeping season" },
  { name: "Grain Rain", nameCn: "谷雨", month: 4, approxDay: 20,
    season: "spring", description: "Grain rain, last frost" },
  { name: "Start of Summer", nameCn: "立夏", month: 5, approxDay: 6,
    season: "summer", description: "Beginning of summer" },
  { name: "Lesser Fullness", nameCn: "小满", month: 5, approxDay: 21,
    season: "summer", description: "Grain filling but not yet ripe" },
  { name: "Grain in Ear", nameCn: "芒种", month: 6, approxDay: 6,
    season: "summer", description: "Grain in ear, busy farming season" },
  { name: "Summer Solstice", nameCn: "夏至", month: 6, approxDay: 21,
    season: "summer", description: "Longest day, yang energy peaks" },
  { name: "Slight Heat", nameCn: "小暑", month: 7, approxDay: 7,
    season: "summer", description: "Slight heat begins" },
  { name: "Great Heat", nameCn: "大暑", month: 7, approxDay: 23,
    season: "summer", description: "Great heat, hottest period" },
  { name: "Start of Autumn", nameCn: "立秋", month: 8, approxDay: 8,
    season: "autumn", description: "Beginning of autumn" },
  { name: "End of Heat", nameCn: "处暑", month: 8, approxDay: 23,
    season: "autumn", description: "End of heat, lingering warmth" },
  { name: "White Dew", nameCn: "白露", month: 9, approxDay: 8,
    season: "autumn", description: "White dew, cool nights" },
  { name: "Autumn Equinox", nameCn: "秋分", month: 9, approxDay: 23,
    season: "autumn", description: "Autumn equinox, balanced day and night" },
  { name: "Cold Dew", nameCn: "寒露", month: 10, approxDay: 8,
    season: "autumn", description: "Cold dew, winter approaches" },
  { name: "Frost's Descent", nameCn: "霜降", month: 10, approxDay: 23,
    season: "autumn", description: "Frost descends, leaves fall" },
  { name: "Start of Winter", nameCn: "立冬", month: 11, approxDay: 7,
    season: "winter", description: "Beginning of winter" },
  { name: "Lesser Snow", nameCn: "小雪", month: 11, approxDay: 22,
    season: "winter", description: "Lesser snow begins" },
  { name: "Greater Snow", nameCn: "大雪", month: 12, approxDay: 7,
    season: "winter", description: "Greater snow, heavy snow season" },
  { name: "Winter Solstice", nameCn: "冬至", month: 12, approxDay: 22,
    season: "winter", description: "Winter solstice, shortest day, yang begins to renew" },
  { name: "Lesser Cold", nameCn: "小寒", month: 1, approxDay: 6,
    season: "winter", description: "Lesser cold, deep winter" },
  { name: "Greater Cold", nameCn: "大寒", month: 1, approxDay: 20,
    season: "winter", description: "Greater cold, coldest period" },
];

function getCurrentSolarTerm(): typeof SOLAR_TERMS[0] | null {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  for (let i = 0; i < SOLAR_TERMS.length; i++) {
    const curr = SOLAR_TERMS[i];
    const next = SOLAR_TERMS[(i + 1) % SOLAR_TERMS.length];
    const currMonth = curr.month;
    const nextMonth = next.month === 1 && curr.month === 12 ? 13 : next.month;

    const currDate = currMonth * 100 + curr.approxDay;
    const nextDate = nextMonth * 100 + next.approxDay;
    const today = month * 100 + day;

    if (today >= currDate && today < nextDate) {
      return curr;
    }
  }
  return SOLAR_TERMS[0];
}

export const solarTermsAdapter: SourceAdapter = {
  sourceType: "context",
  sourceName: "Solar Terms",

  async fetch(): Promise<SourceRecord[]> {
    const term = getCurrentSolarTerm();
    if (!term) return [];

    const now = new Date();
    const year = now.getFullYear();

    return [{
      id: generateId("solar"),
      source: "solar-terms",
      sourceType: this.sourceType,
      url: "",
      fetchedAt: now.toISOString(),
      raw: {
        name: term.name,
        nameCn: term.nameCn,
        season: term.season,
        description: term.description,
        year,
        date: `${year}-${String(term.month).padStart(2, "0")}-${String(term.approxDay).padStart(2, "0")}`,
      },
    }];
  },

  normalize(record: SourceRecord): SignalRecord[] {
    const raw = record.raw as Record<string, unknown>;
    const name = raw["name"] as string;
    const nameCn = raw["nameCn"] as string;
    const season = raw["season"] as string;
    const description = raw["description"] as string;
    const date = raw["date"] as string;

    return [{
      id: record.id,
      sourceType: record.sourceType,
      sourceId: `solar-term-${date}`,
      title: `Solar Term: ${name} (${nameCn})`,
      summary: `${description}. Season: ${season}. Date: ${date}.`,
      url: "",
      publishedAt: date,
      fetchedAt: record.fetchedAt,
      tags: ["solar-term", "chinese-calendar", "cultural", season],
      metadata: {
        name,
        nameCn,
        season,
        description,
        date,
        topics: ["solar-term", "chinese-calendar"],
      },
    }];
  },

  estimatedCallsPerRun() { return 1; },
  cacheTTLMs() { return 24 * 60 * 60 * 1000; },
};

export default solarTermsAdapter;