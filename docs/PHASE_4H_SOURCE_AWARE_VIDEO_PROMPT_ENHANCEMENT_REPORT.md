# Phase 4H — Source-aware Video Prompt Enhancement

**Date:** 2026-06-13
**Phase:** 4H
**STATUS:** PASS

---

## What Changed

Phase 4H introduces source-aware video-prompt enhancement for all 25 Content Packs. New file outputs per pack (3 files, never overwrites originals):

| File | Purpose |
|------|---------|
| `video-prompt.enriched.md` | Chinese intent + 事实依据 + 镜头设计 (3 shots) + 画面风格 + Hailuo prompt + Negative + 推荐参数 + 不确定性 |
| `video-prompt.zh.md` | Human-readable Chinese explanation with 5 bullets (intent, facts, use, style, real-gen suitability) |
| `video-prompt.meta.json` | Machine-readable: shots[], facts_used[], parameters, llm_used=false, video_model_called=false, etc. |

`video-prompt.md` (original) is preserved — never overwritten. Idempotent: re-run produces same result.

---

## Source-Type Strategies (6)

| source_type | 视频方向 | 镜头叙事 |
|-------------|----------|----------|
| **code** | AI 工具工作流 / Agent pipeline / open-source project launch | 节点出现 → 连线 → 指标瓦片收尾 |
| **academic** | 论文概念动画 / 数据曲线 / 概念网络 | 概念图 → 推导/连线 → 论文气质收尾 |
| **ai-ecosystem** | model pipeline flow (input → model → output) | 输入图标 → 模型块 → 输出；末尾指标瓦片 |
| **dev-community** | developer pain point short clip / 讨论地图 | 工作场景/讨论 → 上下文压力 → 收尾 |
| **culture-art** | museum lighting cinematic shot / 古典重绎 | 聚光 → 慢推到细节 → 油画质感收尾 |
| **context** | daily mood clip / 时间氛围 | 氛围天空 → 静物 → 收尾 |

Branch selection is **deterministic** (title/topic/task keyword match) — no LLM, no randomness.

---

## Hard Rules Enforced

- ❌ NO MiniMax / image / video / music model calls
- ❌ NO external LLM calls
- ❌ NO new media generated
- ❌ NO overwriting of `video-prompt.md` (originals preserved)
- ❌ NO fake company logos, real branding, tiny on-screen text
- ❌ NO copyrighted characters, real person likeness
- ❌ NO distorted hands, rapid cuts, shaky camera
- ✅ Default 6-8s short clips (3 shots: 3s+3s+2s)
- ✅ Default 16:9 aspect ratio
- ✅ Default Hailuo model family (prompt-only, no real gen)
- ✅ All facts cited are public, sourced from existing pack data

---

## Files Added

- `scripts/enhance-video-prompts.ts` (~770 lines, deterministic rule-based generator)
- `scripts/validate-video-prompt-enhancement.ts` (859 checks across 25 packs)
- `package.json` — new scripts: `prompts:video:enhance`, `validate:video-prompt-enhancement`

## Files Modified

- `package.json` (added 2 scripts)

## Files Generated (per pack, 25 × 3 = 75)

- `content-packs/.../video-prompt.enriched.md` (25)
- `content-packs/.../video-prompt.zh.md` (25)
- `content-packs/.../video-prompt.meta.json` (25)

---

## Validation Results

`npm run validate:video-prompt-enhancement`:

```
[validate-video-prompts] 859/859 checks passed
[validate-video-prompts] enriched.md: 25/25
[validate-video-prompts] zh.md: 25/25
[validate-video-prompts] meta.json: 25/25
[validate-video-prompts] original video-prompt.md preserved: 5/25 (others never had original)
[validate-video-prompts] by source_type: {
  code: 5,
  academic: 5,
  'culture-art': 5,
  'dev-community': 5,
  'ai-ecosystem': 5
}
```

Per-pack checks include:
- 3 shots, each with id/duration_s/description/camera/motion
- english_prompt length 120-2400 chars
- intent_zh length 40-1000 chars
- parameters: modelFamily=hailuo, duration in [6,8], aspectRatio=16:9, generationMode=prompt-only
- priority in [high, medium, low]
- facts_used ≥ 1
- No LLM markers (MiniMax, gpt-4, claude)
- No API keys / secrets
- `llm_used=false`, `video_model_called=false`, `image_model_called=false`, `music_generated=false`, `new_media_generated=false`

---

## Boundaries Verified

| Rule | Status |
|------|--------|
| No MiniMax call | ✅ |
| No image model call | ✅ |
| No video model call | ✅ |
| No music generation | ✅ |
| No new media | ✅ |
| No external LLM | ✅ |
| No systemd timer change | ✅ |
| No gateway config change | ✅ |
| No .env / token commit | ✅ |
| Long report via project sender | ✅ |
| OpenClaw final reply: 1 sentence | ✅ |
| No intermediate messages | ✅ |

---

## Next Phase Proposal

- **Phase 4I** (proposed): Gallery video card — render video-prompt.enriched.md as HTML embed in `content-packs/.../index.html`, surface "▶ 8s video" badge. Static preview only, no actual playback.
- **Phase 4J** (proposed): Video prompt scoring — add scoring layer (visual density, fact grounding, negative-prompt coverage) to rank enriched prompts.
- **Phase 5C** (longer-term): Per-source budget extension to video prompts (max 30s per run, etc.).

Phase 4H: PASS
