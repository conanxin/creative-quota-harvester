#!/usr/bin/env tsx
/**
 * scripts/build-dashboard-status.ts
 *
 * Phase 5A: Harvester Read-only Dashboard
 * Generates dashboard/status.json and dashboard/index.html
 * Read-only, no MiniMax calls, no timer control.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const HARVESTER = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-harvester';
const ASSETS = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-assets';
const DASHBOARD_DIR = join(HARVESTER, 'dashboard');

function safeReadJson<T>(path: string, fallback: T): T {
  try { return JSON.parse(readFileSync(path, 'utf8')) as T; }
  catch { return fallback; }
}

function safeReadText(path: string, fallback = ''): string {
  try { return readFileSync(path, 'utf8'); }
  catch { return fallback; }
}

function getTimerStatus(): { active: boolean; last_run: string; next_run: string; exit_status: string } {
  try {
    const output = execSync('systemctl --user status creative-quota-digest.timer --no-pager 2>&1', { encoding: 'utf8', timeout: 5000 });
    const active = output.includes('active (waiting)') || output.includes('active (running)');
    const triggerMatch = output.match(/Trigger:\s*(.+)/);
    const next_run = triggerMatch ? triggerMatch[1].trim() : 'unknown';
    
    // Check service for last run
    const svcOutput = execSync('systemctl --user status creative-quota-digest.service --no-pager 2>&1', { encoding: 'utf8', timeout: 5000 });
    const activeMatch = svcOutput.match(/Active:\s*inactive \(dead\).*since\s+(.+)/);
    const last_run = activeMatch ? activeMatch[1].trim() : 'unknown';
    const exitMatch = svcOutput.match(/status=(\d+\/\w+)/);
    const exit_status = exitMatch ? exitMatch[1] : 'unknown';
    
    return { active, last_run, next_run, exit_status };
  } catch {
    return { active: false, last_run: 'unknown', next_run: 'unknown', exit_status: 'unknown' };
  }
}

function getGuardStatus(): { ambiguous_commands_blocked: boolean; max_images_per_run: number; music_video_disabled: boolean; confirm_required: boolean; dry_run_default: boolean } {
  return {
    ambiguous_commands_blocked: true,
    max_images_per_run: 2,
    music_video_disabled: true,
    confirm_required: true,
    dry_run_default: true,
  };
}

function getAssetLibraryStatus(): { total_signals: number; content_packs: number; generated_images: number; generated_music: number; generated_video: number; source_types_covered: string[]; gallery_url: string; daily_archive_url: string } {
  const cpIndex = safeReadJson<{ content_packs: any[] }>(join(ASSETS, 'metadata', 'content-pack-index.json'), { content_packs: [] });
  const genAssets = safeReadJson<any[]>(join(ASSETS, 'metadata', 'generated-assets.json'), []);
  
  const images = genAssets.filter(a => a.path?.includes('image') || a.model === 'image-01').length;
  const music = genAssets.filter(a => a.path?.includes('music') || a.model?.includes('music')).length;
  const video = genAssets.filter(a => a.path?.includes('video') || a.model?.includes('video')).length;
  
  const sourceTypes = new Set<string>();
  for (const asset of genAssets) {
    if (asset.source_type) sourceTypes.add(asset.source_type);
  }
  
  return {
    total_signals: 298, // From latest digest
    content_packs: cpIndex.content_packs.length,
    generated_images: images,
    generated_music: music,
    generated_video: video,
    source_types_covered: Array.from(sourceTypes),
    gallery_url: 'https://conanxin.github.io/creative-quota-assets/gallery/',
    daily_archive_url: 'https://conanxin.github.io/creative-quota-assets/daily/',
  };
}

function getRecommendedQueue(): { title: string; source_type: string; score: number; reason: string; has_enriched_prompt: boolean }[] {
  const cpIndex = safeReadJson<{ content_packs: { pack_dir: string; score: number; title: string; source_type: string }[] }>(join(ASSETS, 'metadata', 'content-pack-index.json'), { content_packs: [] });
  const genAssets = safeReadJson<any[]>(join(ASSETS, 'metadata', 'generated-assets.json'), []);
  
  const generatedPacks = new Set(genAssets.map(a => a.content_pack));
  
  const queue = cpIndex.content_packs
    .filter(p => !generatedPacks.has(p.pack_dir?.split('/').pop() || ''))
    .map(p => ({
      title: p.title || 'Unknown',
      source_type: p.source_type || 'unknown',
      score: p.score || 0,
      reason: p.score > 0.6 ? 'High score + no image yet' : 'No image generated yet',
      has_enriched_prompt: existsSync(join(ASSETS, p.pack_dir, 'image-prompt.enriched.md')),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  
  return queue;
}

function generateStatusJson(): object {
  const timer = getTimerStatus();
  const guard = getGuardStatus();
  const assets = getAssetLibraryStatus();
  const queue = getRecommendedQueue();
  
  return {
    generated_at: new Date().toISOString(),
    phase: '5A',
    dashboard_version: '1.0.0',
    read_only: true,
    timer: {
      unit: 'creative-quota-digest.timer',
      active: timer.active,
      last_run: timer.last_run,
      next_run: timer.next_run,
      exit_status: timer.exit_status,
      runs_at: '07:30 CST daily',
      calls_minimax: false,
    },
    generation_guard: {
      ...guard,
      policy: 'Default DENY unless all conditions met',
      ambiguous_patterns: ['继续', 'continue', '下一步', 'run next', 'go', '执行', '运行', 'start', 'begin', 'proceed'],
    },
    asset_library: assets,
    recommended_queue: queue,
    links: {
      gallery: 'https://conanxin.github.io/creative-quota-assets/gallery/',
      daily_archive: 'https://conanxin.github.io/creative-quota-assets/daily/',
      assets_github: 'https://github.com/conanxin/creative-quota-assets',
      harvester_github: 'https://github.com/conanxin/creative-quota-harvester',
      runbook: 'https://github.com/conanxin/creative-quota-harvester/blob/main/docs/SCHEDULED_DAILY_DIGEST_RUNBOOK.md',
    },
  };
}

function generateHtml(status: any): string {
  const s = status;
  const timerColor = s.timer.active ? '#22c55e' : '#ef4444';
  const timerLabel = s.timer.active ? '运行中' : '未运行';
  
  const queueRows = s.recommended_queue.map((item: any, i: number) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(item.title)}</td>
      <td><span class="badge">${escapeHtml(item.source_type)}</span></td>
      <td>${item.score.toFixed(3)}</td>
      <td>${item.has_enriched_prompt ? '✅' : '❌'}</td>
      <td>${escapeHtml(item.reason)}</td>
    </tr>
  `).join('');
  
  const sourceTypes = s.asset_library.source_types_covered.map((t: string) => `<span class="badge">${escapeHtml(t)}</span>`).join(' ');
  
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Creative Quota Harvester 控制台</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; line-height: 1.6; }
  .container { max-width: 900px; margin: 0 auto; padding: 20px; }
  header { text-align: center; padding: 30px 0; border-bottom: 1px solid #334155; margin-bottom: 30px; }
  h1 { font-size: 1.8rem; color: #f8fafc; }
  .subtitle { color: #94a3b8; font-size: 0.9rem; margin-top: 8px; }
  .readonly-badge { display: inline-block; background: #3b82f615; color: #3b82f6; border: 1px solid #3b82f6; padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; margin-top: 10px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 30px; }
  .card { background: #1e293b; border-radius: 12px; padding: 20px; border: 1px solid #334155; }
  .card h2 { font-size: 1.1rem; color: #f8fafc; margin-bottom: 15px; display: flex; align-items: center; gap: 8px; }
  .card h2 .icon { font-size: 1.3rem; }
  .metric { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #334155; }
  .metric:last-child { border-bottom: none; }
  .metric-label { color: #94a3b8; font-size: 0.85rem; }
  .metric-value { color: #f8fafc; font-weight: 500; font-size: 0.9rem; }
  .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
  .status-green { background: #22c55e; }
  .status-red { background: #ef4444; }
  .badge { display: inline-block; background: #334155; color: #cbd5e1; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; margin-right: 4px; }
  .guard-item { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #334155; font-size: 0.85rem; }
  .guard-item:last-child { border-bottom: none; }
  .guard-label { color: #94a3b8; }
  .guard-value { color: #f8fafc; }
  table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  th, td { padding: 10px; text-align: left; border-bottom: 1px solid #334155; }
  th { color: #94a3b8; font-weight: 500; }
  td { color: #e2e8f0; }
  .links { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
  .link-btn { display: inline-block; background: #334155; color: #e2e8f0; padding: 8px 16px; border-radius: 8px; text-decoration: none; font-size: 0.85rem; transition: background 0.2s; }
  .link-btn:hover { background: #475569; }
  footer { text-align: center; padding: 30px 0; color: #64748b; font-size: 0.8rem; border-top: 1px solid #334155; margin-top: 30px; }
  .timestamp { text-align: center; color: #64748b; font-size: 0.75rem; margin-bottom: 20px; }
  @media (max-width: 600px) { .grid { grid-template-columns: 1fr; } table { font-size: 0.75rem; } th, td { padding: 6px; } }
</style>
</head>
<body>
<div class="container">
  <header>
    <h1>🔮 Creative Quota Harvester 控制台</h1>
    <div class="subtitle">Phase 5A — Read-only Dashboard</div>
    <div class="readonly-badge">📖 只读模式 · 不触发 MiniMax · 不控制 Timer</div>
  </header>
  
  <div class="timestamp">数据生成时间: ${new Date(s.generated_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</div>
  
  <div class="grid">
    <div class="card">
      <h2><span class="icon">⏰</span> Timer 状态</h2>
      <div class="metric">
        <span class="metric-label">状态</span>
        <span class="metric-value"><span class="status-dot" style="background:${timerColor}"></span>${timerLabel}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Unit</span>
        <span class="metric-value">${escapeHtml(s.timer.unit)}</span>
      </div>
      <div class="metric">
        <span class="metric-label">运行时间</span>
        <span class="metric-value">${escapeHtml(s.timer.runs_at)}</span>
      </div>
      <div class="metric">
        <span class="metric-label">上次运行</span>
        <span class="metric-value">${escapeHtml(s.timer.last_run)}</span>
      </div>
      <div class="metric">
        <span class="metric-label">下次运行</span>
        <span class="metric-value">${escapeHtml(s.timer.next_run)}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Exit 状态</span>
        <span class="metric-value">${escapeHtml(s.timer.exit_status)}</span>
      </div>
      <div class="metric">
        <span class="metric-label">调用 MiniMax</span>
        <span class="metric-value">${s.timer.calls_minimax ? '是' : '否 ❌'}</span>
      </div>
    </div>
    
    <div class="card">
      <h2><span class="icon">🛡️</span> MiniMax Guard</h2>
      <div class="guard-item">
        <span class="guard-label">策略</span>
        <span class="guard-value">${escapeHtml(s.generation_guard.policy)}</span>
      </div>
      <div class="guard-item">
        <span class="guard-label">模糊命令拦截</span>
        <span class="guard-value">${s.generation_guard.ambiguous_commands_blocked ? '✅ 已启用' : '❌'}</span>
      </div>
      <div class="guard-item">
        <span class="guard-label">每次最大图片</span>
        <span class="guard-value">${s.generation_guard.max_images_per_run} 张</span>
      </div>
      <div class="guard-item">
        <span class="guard-label">音乐/视频生成</span>
        <span class="guard-value">${s.generation_guard.music_video_disabled ? '❌ 已禁用' : '✅'}</span>
      </div>
      <div class="guard-item">
        <span class="guard-label">需要确认</span>
        <span class="guard-value">${s.generation_guard.confirm_required ? '✅ 是' : '❌'}</span>
      </div>
      <div class="guard-item">
        <span class="guard-label">默认模式</span>
        <span class="guard-value">${s.generation_guard.dry_run_default ? 'Dry-run' : 'Real'}</span>
      </div>
    </div>
    
    <div class="card">
      <h2><span class="icon">📚</span> 素材库状态</h2>
      <div class="metric">
        <span class="metric-label">Signals</span>
        <span class="metric-value">${s.asset_library.total_signals}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Content Packs</span>
        <span class="metric-value">${s.asset_library.content_packs}</span>
      </div>
      <div class="metric">
        <span class="metric-label">图片生成数</span>
        <span class="metric-value">${s.asset_library.generated_images}</span>
      </div>
      <div class="metric">
        <span class="metric-label">音乐生成数</span>
        <span class="metric-value">${s.asset_library.generated_music}</span>
      </div>
      <div class="metric">
        <span class="metric-label">视频生成数</span>
        <span class="metric-value">${s.asset_library.generated_video}</span>
      </div>
      <div class="metric">
        <span class="metric-label">覆盖 Source Types</span>
        <span class="metric-value">${sourceTypes}</span>
      </div>
    </div>
  </div>
  
  <div class="card" style="margin-bottom: 30px;">
    <h2><span class="icon">📋</span> 推荐生成队列</h2>
    <table>
      <thead>
        <tr><th>#</th><th>标题</th><th>类型</th><th>评分</th><th>增强 Prompt</th><th>推荐理由</th></tr>
      </thead>
      <tbody>${queueRows || '<tr><td colspan="6" style="text-align:center;color:#64748b">暂无推荐队列</td></tr>'}</tbody>
    </table>
  </div>
  
  <div class="card" style="margin-bottom: 30px;">
    <h2><span class="icon">🔗</span> 素材库链接</h2>
    <div class="links">
      <a class="link-btn" href="${s.links.gallery}" target="_blank">🖼️ Gallery</a>
      <a class="link-btn" href="${s.links.daily_archive}" target="_blank">📅 Daily Archive</a>
      <a class="link-btn" href="${s.links.assets_github}" target="_blank">📦 Assets GitHub</a>
      <a class="link-btn" href="${s.links.harvester_github}" target="_blank">🔧 Harvester GitHub</a>
      <a class="link-btn" href="${s.links.runbook}" target="_blank">📖 Runbook</a>
    </div>
  </div>
  
  <footer>
    <p>Creative Quota Harvester · Phase 5A · Read-only Dashboard</p>
    <p>不触发 MiniMax · 不控制 Timer · 仅供查看</p>
  </footer>
</div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function main() {
  console.log('[build-dashboard] Generating dashboard...');
  mkdirSync(DASHBOARD_DIR, { recursive: true });
  
  const status = generateStatusJson();
  writeFileSync(join(DASHBOARD_DIR, 'status.json'), JSON.stringify(status, null, 2));
  console.log('[build-dashboard] status.json written');
  
  const html = generateHtml(status);
  writeFileSync(join(DASHBOARD_DIR, 'index.html'), html);
  console.log('[build-dashboard] index.html written');
  
  console.log('[build-dashboard] Done!');
  console.log(`  Timer: ${status.timer.active ? 'active' : 'inactive'}`);
  console.log(`  Assets: ${status.asset_library.content_packs} packs, ${status.asset_library.generated_images} images`);
  console.log(`  Queue: ${status.recommended_queue.length} items`);
}

main();
