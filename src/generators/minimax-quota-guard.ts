/**
 * minimax-quota-guard.ts — Phase 3C
 * 
 * Quota guard: runs mmx quota and decides if generation should proceed.
 * Default policy: block if interval remaining < 50%.
 * 
 * Usage:
 *   const result = await checkQuota();
 *   if (result.decision === 'BLOCK') { ... }
 */

import { execSync } from 'child_process';

export interface QuotaStatus {
  decision: 'ALLOW' | 'BLOCK' | 'ERROR';
  general_interval_percent: number;
  general_weekly_percent: number;
  video_interval_percent: number;
  video_weekly_percent: number;
  raw_output?: string;
  error?: string;
}

const MIN_INTERVAL_PERCENT = 50;
const MIN_WEEKLY_PERCENT = 50;

export async function checkQuota(): Promise<QuotaStatus> {
  try {
    // Unset proxy to avoid SOCKS issues with mmx CLI
    const env = { ...process.env };
    delete env.https_proxy;
    delete env.http_proxy;
    delete env.all_proxy;
    delete env.no_proxy;

    const output = execSync('mmx quota --output json 2>&1', {
      env,
      timeout: 15 * 1000,
      encoding: 'utf-8',
    });

    let parsed: any;
    try {
      parsed = JSON.parse(output);
    } catch {
      return {
        decision: 'ERROR',
        general_interval_percent: 0,
        general_weekly_percent: 0,
        video_interval_percent: 0,
        video_weekly_percent: 0,
        raw_output: output,
        error: 'Failed to parse mmx quota JSON',
      };
    }

    const modelMap: Record<string, any> = {};
    for (const m of parsed.model_remains || []) {
      modelMap[m.model_name] = m;
    }

    const general = modelMap['general'] || {};
    const video = modelMap['video'] || {};

    const generalInterval = general.current_interval_remaining_percent || 0;
    const generalWeekly = general.current_weekly_remaining_percent || 0;
    const videoInterval = video.current_interval_remaining_percent || 0;
    const videoWeekly = video.current_weekly_remaining_percent || 0;

    // Default: block if general interval < threshold
    const decision = generalInterval >= MIN_INTERVAL_PERCENT ? 'ALLOW' : 'BLOCK';

    return {
      decision,
      general_interval_percent: generalInterval,
      general_weekly_percent: generalWeekly,
      video_interval_percent: videoInterval,
      video_weekly_percent: videoWeekly,
    };
  } catch (e: any) {
    return {
      decision: 'ERROR',
      general_interval_percent: 0,
      general_weekly_percent: 0,
      video_interval_percent: 0,
      video_weekly_percent: 0,
      error: e.message || String(e),
    };
  }
}

export function formatQuotaSummary(status: QuotaStatus): string {
  if (status.decision === 'ERROR') {
    return `Quota check ERROR: ${status.error}. Blocking generation by default.`;
  }
  const lines = [
    `MiniMax Quota Status`,
    `general: ${status.general_interval_percent}% interval / ${status.general_weekly_percent}% weekly`,
    `video: ${status.video_interval_percent}% interval / ${status.video_weekly_percent}% weekly`,
    `Decision: ${status.decision} (threshold: ${MIN_INTERVAL_PERCENT}%)`,
  ];
  return lines.join('\n');
}
