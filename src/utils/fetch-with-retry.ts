/**
 * fetch-with-retry.ts — Generic fetch with retry, backoff, and curl fallback
 * Phase: 1R
 */
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface FetchOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  maxRetryDelayMs?: number;
  acceptText?: boolean;
  acceptXml?: boolean;
  userAgent?: string;
}

export interface FetchResult {
  ok: boolean;
  status: number;
  data: unknown;
  text: string;
  headers: Record<string, string>;
  durationMs: number;
  error?: string;
  method: string;
  url: string;
  usedCurlFallback: boolean;
}

const DEFAULT_UA = "creative-quota-harvester/1.0 (personal research; contact@example.com)";

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse JSON safely
 */
function tryParseJSON(text: string): unknown {
  try { return JSON.parse(text); }
  catch { return undefined; }
}

/**
 * Main fetch function with retry + curl fallback
 */
export async function fetchWithRetry(opts: FetchOptions): Promise<FetchResult> {
  const {
    url,
    method = "GET",
    headers = {},
    body,
    timeoutMs = 20000,
    retries = 3,
    retryDelayMs = 1000,
    maxRetryDelayMs = 30000,
    acceptText = false,
    acceptXml = false,
    userAgent = DEFAULT_UA,
  } = opts;

  const startMs = Date.now();
  const resultHeaders: Record<string, string> = {};

  // Build headers (merge user-agent)
  const reqHeaders: Record<string, string> = {
    "User-Agent": userAgent,
    ...headers,
  };

  // Determine accept header
  if (acceptXml) reqHeaders["Accept"] = "application/xml, text/xml";
  else if (acceptText) reqHeaders["Accept"] = "text/plain, application/json";
  else reqHeaders["Accept"] = "application/json";

  // Try native fetch first
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(retryDelayMs * Math.pow(2, attempt - 1), maxRetryDelayMs);
      console.log(`[fetch-retry] Attempt ${attempt +1} after ${delay}ms delay`);
      await sleep(delay);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch(url, {
        method,
        headers: reqHeaders,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const durationMs = Date.now() - startMs;
      resp.headers.forEach((v, k) => { resultHeaders[k.toLowerCase()] = v; });

      const text = await resp.text();
      let data: unknown = undefined;
      if (acceptXml || acceptText) {
        data = text;
      } else {
        data = tryParseJSON(text);
      }

      if (resp.ok) {
        return {
          ok: true, status: resp.status, data, text, headers: resultHeaders,
          durationMs, method, url, usedCurlFallback: false,
        };
      }

      // Non-OK status — retry on 5xx or 429, not on 4xx
      if (resp.status >= 400 && resp.status < 500 && resp.status !== 429) {
        return {
          ok: false, status: resp.status, data, text, headers: resultHeaders,
          durationMs, error: `HTTP ${resp.status}`, method, url, usedCurlFallback: false,
        };
      }

      if (attempt < retries) {
        console.warn(`[fetch-retry] HTTP ${resp.status}, retrying...`);
        continue;
      }

      return {
        ok: false, status: resp.status, data, text, headers: resultHeaders,
        durationMs, error: `HTTP ${resp.status} after ${retries + 1} attempts`, method, url, usedCurlFallback: false,
      };
    } catch (err: unknown) {
      clearTimeout(timeout);
      const durationMs = Date.now() - startMs;
      const msg = err instanceof Error ? err.message : String(err);
      const isAbort = msg.includes("aborted") || msg.includes("timeout") || msg.includes("timeout");

      if (attempt < retries) {
        console.warn(`[fetch-retry] Attempt ${attempt + 1} failed: ${msg}, retrying...`);
        continue;
      }

      // All retries exhausted — try curl fallback
      console.warn(`[fetch-retry] Native fetch failed after ${attempt + 1} attempts: ${msg}`);
      console.log(`[fetch-retry] Falling back to curl for: ${url}`);
      return await curlFallback(url, method, reqHeaders, body, timeoutMs, durationMs);
    }
  }

  // Should not reach here
  const durationMs = Date.now() - startMs;
  return {
    ok: false, status: 0, data: undefined, text: "", headers: {},
    durationMs, error: "Exhausted retries", method, url, usedCurlFallback: false,
  };
}

/**
 * curl fallback — last resort when native fetch fails
 */
async function curlFallback(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string | undefined,
  timeoutMs: number,
  durationSoFar: number,
): Promise<FetchResult> {
  const startMs = Date.now();

  // Build curl command
  let cmd = `curl -s -X ${method} --max-time ${Math.ceil(timeoutMs / 1000)}`;
  for (const [k, v] of Object.entries(headers)) {
    cmd += ` -H "${k}: ${v.replace(/"/g, '\\"')}"`;
  }
  if (body) {
    cmd += ` -d '${body.replace(/'/g, "'\"'\"'")}'`;
  }
  cmd += ` '${url.replace(/'/g, "'\"'\"'")}'`;

  try {
    const text = execSync(cmd, { timeout: timeoutMs + 5000, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
    const data = tryParseJSON(text);
    const durationMs = Date.now() - startMs + durationSoFar;

    return {
      ok: true, status: data ? 200 : 0, data: data ?? text, text,
      headers: {},
      durationMs,
      error: data ? undefined : "curl returned non-JSON",
      method, url, usedCurlFallback: true,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startMs + durationSoFar;
    return {
      ok: false, status: 0, data: undefined, text: "", headers: {},
      durationMs,
      error: `curl fallback failed: ${errMsg}`,
      method, url, usedCurlFallback: true,
    };
  }
}

/**
 * Diagnose connectivity for a single URL
 */
export async function diagnoseUrl(url: string, label: string): Promise<{
  label: string;
  url: string;
  reachable: boolean;
  status: number | null;
  error: string | null;
  durationMs: number;
  usedCurl: boolean;
  headers: Record<string, string>;
}> {
  const result = await fetchWithRetry({ url, timeoutMs: 15000, retries: 1 });
  return {
    label,
    url: result.url,
    reachable: result.ok,
    status: result.status || null,
    error: result.error || null,
    durationMs: result.durationMs,
    usedCurl: result.usedCurlFallback,
    headers: result.headers,
  };
}

export default fetchWithRetry;