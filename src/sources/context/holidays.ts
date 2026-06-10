/**
 * Holidays Source Adapter — Phase 1 Real Implementation
 * Embedded holiday data (no external API needed)
 */
import { generateId } from "../utils";
import type { SourceAdapter, SourceRecord, SignalRecord } from "../types";

// Major holidays with dates (month, day)
const HOLIDAYS: Array<{
  name: string; nameCn: string; month: number; day: number;
  country: string; type: "public" | "observance";
}> = [
  // Chinese holidays
  { name: "Chinese New Year", nameCn: "春节", month: 1, day: 29, country: "CN", type: "public" },
  { name: "Lantern Festival", nameCn: "元宵节", month: 2, day: 12, country: "CN", type: "observance" },
  { name: "Qingming Festival", nameCn: "清明节", month: 4, day: 5, country: "CN", type: "public" },
  { name: "Dragon Boat Festival", nameCn: "端午节", month: 5, day: 31, country: "CN", type: "public" },
  { name: "Mid-Autumn Festival", nameCn: "中秋节", month: 9, day: 17, country: "CN", type: "public" },
  { name: "National Day", nameCn: "国庆节", month: 10, day: 1, country: "CN", type: "public" },
  // US holidays
  { name: "New Year's Day", nameCn: "元旦", month: 1, day: 1, country: "US", type: "public" },
  { name: "Independence Day", nameCn: "独立日", month: 7, day: 4, country: "US", type: "public" },
  { name: "Thanksgiving", nameCn: "感恩节", month: 11, day: 26, country: "US", type: "public" },
  { name: "Christmas", nameCn: "圣诞节", month: 12, day: 25, country: "US", type: "public" },
  // Global
  { name: "International Women's Day", nameCn: "国际妇女节", month: 3, day: 8, country: "GLOBAL", type: "observance" },
  { name: "Earth Day", nameCn: "地球日", month: 4, day: 22, country: "GLOBAL", type: "observance" },
  { name: "World Book Day", nameCn: "世界读书日", month: 4, day: 23, country: "GLOBAL", type: "observance" },
  { name: "International Day of Museums", nameCn: "国际博物馆日", month: 5, day: 18, country: "GLOBAL", type: "observance" },
  { name: "World Environment Day", nameCn: "世界环境日", month: 6, day: 5, country: "GLOBAL", type: "observance" },
];

function getUpcomingHoliday(): typeof HOLIDAYS[0] | null {
  const now = new Date();
  const year = now.getFullYear();
  const today = now.getMonth() * 100 + now.getDate();

  // Check upcoming holidays in current year
  for (const h of HOLIDAYS) {
    const holidayDate = h.month * 100 + h.day;
    if (holidayDate >= today) {
      return h;
    }
  }
  // Wrap to next year
  return HOLIDAYS[0];
}

function formatHolidayDate(month: number, day: number, year: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export const holidaysAdapter: SourceAdapter = {
  sourceType: "context",
  sourceName: "Holidays",

  async fetch(): Promise<SourceRecord[]> {
    const now = new Date();
    const year = now.getFullYear();
    const holiday = getUpcomingHoliday();
    if (!holiday) return [];

    const dateStr = formatHolidayDate(holiday.month, holiday.day, year);

    return [{
      id: generateId("holiday"),
      source: "holidays",
      sourceType: this.sourceType,
      url: "",
      fetchedAt: now.toISOString(),
      raw: {
        name: holiday.name,
        nameCn: holiday.nameCn,
        country: holiday.country,
        type: holiday.type,
        date: dateStr,
        year,
      },
    }];
  },

  normalize(record: SourceRecord): SignalRecord[] {
    const raw = record.raw as Record<string, unknown>;
    const name = raw["name"] as string;
    const nameCn = raw["nameCn"] as string;
    const country = raw["country"] as string;
    const type = raw["type"] as string;
    const date = raw["date"] as string;

    return [{
      id: record.id,
      sourceType: record.sourceType,
      sourceId: `holiday-${date}`,
      title: `Holiday: ${name} (${nameCn})`,
      summary: `${type === "public" ? "Public holiday" : "Observance"} in ${country}. Date: ${date}.`,
      url: "",
      publishedAt: date,
      fetchedAt: record.fetchedAt,
      tags: ["holiday", "cultural", country.toLowerCase(), type],
      metadata: {
        name,
        nameCn,
        country,
        type,
        date,
        topics: ["holiday", "cultural"],
      },
    }];
  },

  estimatedCallsPerRun() { return 1; },
  cacheTTLMs() { return 24 * 60 * 60 * 1000; },
};

export default holidaysAdapter;