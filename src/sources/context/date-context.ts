/**
 * Date Context Source Adapter — Phase 1 Real Implementation
 * No external API call needed — always fresh
 */
import { generateId } from "../utils";
import type { SourceAdapter, SourceRecord, SignalRecord } from "../types";

export const dateContextAdapter: SourceAdapter = {
  sourceType: "context",
  sourceName: "Date Context",

  async fetch(): Promise<SourceRecord[]> {
    const now = new Date();
    const dow = now.getDay(); // 0=Sun
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];

    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();
    const weekNumber = Math.ceil((day) / 7);
    const quarter = Math.floor(month / 3) + 1;
    const isWeekend = dow === 0 || dow === 6;

    return [{
      id: generateId("date"),
      source: "date-context",
      sourceType: this.sourceType,
      url: "",
      fetchedAt: now.toISOString(),
      raw: {
        date: now.toISOString().split("T")[0],
        dayOfWeek: dayNames[dow],
        dayOfWeekShort: dayNames[dow].slice(0, 3),
        weekNumber,
        month: monthNames[month],
        quarter: `Q${quarter}`,
        year,
        isWeekend,
        unixTimestamp: Math.floor(now.getTime() / 1000),
      },
    }];
  },

  normalize(record: SourceRecord): SignalRecord[] {
    const raw = record.raw as Record<string, unknown>;
    const date = raw["date"] as string;
    const dow = raw["dayOfWeek"] as string;
    const month = raw["month"] as string;
    const quarter = raw["quarter"] as string;
    const year = raw["year"] as number;
    const isWeekend = raw["isWeekend"] as boolean;

    return [{
      id: record.id,
      sourceType: record.sourceType,
      sourceId: `date-context-${date}`,
      title: `Date Context: ${date} (${dow})`,
      summary: `${dow}, ${month} ${year}, ${quarter}, Week ${raw["weekNumber"]}${isWeekend ? " (Weekend)" : ""}`,
      url: "",
      publishedAt: date,
      fetchedAt: record.fetchedAt,
      tags: ["date-context", "calendar", dow.toLowerCase(), month.toLowerCase(), quarter.toLowerCase()],
      metadata: {
        dayOfWeek: dow,
        weekNumber: raw["weekNumber"],
        month,
        quarter,
        year,
        isWeekend,
        topics: ["date-context", "calendar"],
      },
    }];
  },

  estimatedCallsPerRun() { return 1; },
  cacheTTLMs() { return 0; }, // Always fresh
};

export default dateContextAdapter;