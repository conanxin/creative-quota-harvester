/**
 * Shared utilities for source adapters
 */
import { XMLParser } from "fast-xml-parser";

export const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseTagValue: true,
  parseAttributeValue: true,
  trimValues: true,
});

/** Generate a short UUID-like ID */
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Sleep for ms milliseconds */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Truncate text to maxLen characters */
export function truncate(text: string, maxLen: number): string {
  const stripped = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return stripped.length > maxLen ? stripped.slice(0, maxLen) + "…" : stripped;
}

/** Normalize whitespace */
export function normalizeText(text: string | undefined | null): string {
  if (!text) return "";
  return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/** Extract arXiv ID from URL */
export function extractArxivId(url: string): string {
  const match = url.match(/abs\/([0-9.]+)/);
  return match ? match[1] : url;
}

/** Generate keywords from title + summary */
export function extractKeywords(title: string, summary: string, topics: string[] = []): string[] {
  const text = `${title} ${summary} ${topics.join(" ")}`.toLowerCase();
  const wordPattern = /\b[a-z]{4,}\b/g;
  const words = (text.match(wordPattern) || []);
  const unique = [...new Set(words)];
  // Return top 10 most relevant words
  return unique.slice(0, 10);
}

/** Check if text contains any of the keywords */
export function matchesKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some(kw => lower.includes(kw.toLowerCase()));
}

/** Fetch with timeout */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<{ ok: boolean; status: number; data: unknown; headers: Record<string, string> }> {
  const { timeoutMs = 15000, headers = {}, ...rest } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...rest,
      headers: { "User-Agent": "creative-quota-harvester/0.1.0 (personal research project)", ...headers },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const text = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    const respHeaders: Record<string, string> = {};
    response.headers.forEach((v, k) => { respHeaders[k.toLowerCase()] = v; });
    return { ok: response.ok, status: response.status, data, headers: respHeaders };
  } catch (err: unknown) {
    clearTimeout(timeout);
    throw err;
  }
}