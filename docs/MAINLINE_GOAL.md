# MAINLINE_GOAL.md — Creative Quota Harvester 主线目标

**Phase:** 6A (Mainline Recovery)  
**Generated:** 2026-06-15T08:27:00+08:00  
**Status:** Active — Control Plane Frozen

---

## Project North Star

> 把真实世界信号（Real-World Signals）和未使用的模型额度（Unused Model Capacity）转化为可沉淀、可展示、可发布、可复用的内容资产（Reusable Creative Assets）。

---

## Original Goal

Creative Quota Harvester 最初为以下问题而生：

- **信号浪费**：每天有大量 RSS/Firehose/API 信号进来，但只有极少数被转化为可消费内容
- **额度浪费**：模型额度（image/video/music generation）大部分时间处于空闲状态
- **资产流失**：生成的内容散落在对话历史中，没有统一归档和展示

**目标：** 建成一条从信号到资产的自动化流水线。

---

## What the System Is For

| 用途 | 说明 |
|------|------|
| Signal ingestion | 抓取 RSS/Firehose/API 信号，构建信号库 |
| Content Pack production | 将信号转化为结构化内容包（含 brief、facts、prompts） |
| Controlled generation | 在人工审核后执行 image/video/music 生成 |
| Gallery & archive | 展示和归档生成的内容资产 |
| Publishing pipeline | 将资产发布到 X/Blog/Gallery 等平台 |
| Daily digest | 每日生成 digest 内容，记录系统运行状态 |

---

## What the System Is NOT For

| 禁止 | 原因 |
|------|------|
| 自动化社交媒体刷量 | 违反平台规则，无长期价值 |
| 未经审核的批量生成 | 质量失控，资产无效 |
| 24/7 无人值守 promote | 控制台已冻结，需要人工决策 |
| 未经 consent 的内容复制 | 尊重信号来源版权 |
| 金融/医疗等高风险领域 | 非核心场景，优先级低 |

---

## Current Stable Control-Plane Baseline

As of Phase 6A, the following control-plane is **frozen** (no active development):

| Component | Status | Freeze Reason |
|-----------|--------|--------------|
| Control Server (`scripts/control-server.ts`) | ✅ Stable | Functional |
| Daily Digest Promote Gate | ✅ Stable | One controlled promote complete |
| C5N Continuous Promote | ❄️ Frozen | Decision recorded; no real promote |
| Approval State Machine | ❄️ Frozen | Human decision: keep approved but do not promote yet |
| Telegram Send Gate | ❄️ Frozen | Blocked at policy level |
| Timer/Cron Gate | ❄️ Frozen | No auto-trigger |
| Dashboard Safety Policy | ✅ Stable | Hardened and validated |

**Control-plane frozen until:** A content-production blocker is identified that requires control-plane changes to resolve.

---

## Mainline Production Loop

```
Source (RSS/API/Firehose)
    ↓
Signal (collected, stored in signals.db)
    ↓
Content Pack (brief.md + facts.md + source.json + manifest.json)
    ↓
Prompt Pack (image-prompt.md + video-prompt.md + music-prompt.md + x-post.zh.md)
    ↓
Controlled Generation (human review → model call → image/video/music)
    ↓
Review (quality score + recommended_uses)
    ↓
Publish (Gallery / Daily Archive / X post / Blog)
```

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Content packs produced | ≥ 30/month | 25 total (as of 2026-06-11) |
| Unique source types covered | ≥ 5 | 5 (academic, code, culture-art, dev-community, ai-ecosystem) |
| Image generation success rate | ≥ 90% | 5/5 = 100% (5 generated) |
| Gallery coverage | All generated assets | 5/5 in gallery |
| Average quality score | ≥ 85/100 | 96/100 (excellent) |
| Daily digest uptime | 100% | Stable (one controlled promote complete) |
| Content pack → asset conversion | ≥ 60% | Pending (pipeline paused) |

---

## Stop-Doing List

| Stop |替代方案 |
|------|---------|
| 继续扩展 C5N promote/approval/audit 控制台 | 除非阻塞内容生产，不动控制台 |
| 添加新的自动化 timer / cron | 人工触发 content production 阶段 |
| 自动化 Telegram digest 发送 | 人工审核后通过 project-sender 发送 |
| 在 sandbox 外执行 promote | 所有 promote 必须在 sandbox 内完成 dry-run |
| 批量生成不经人工审核 | Prompt Pack 必须经过 human review 再进 generation |
| commit 含 token 的文件 | 已配置 .gitignore，持续保持 |

---

## Control Plane vs. Mainline — Frozen Boundary

**已冻结（控制台主线）：**
- C5N promote / approval / rollback 自动化
- Telegram send auto-trigger
- Timer / cron 自动 promote
- 新增 promote gate 或 approval state transition

**正常进行（内容主线）：**
- Source → Signal → Content Pack pipeline
- Content Pack → Prompt Pack generation
- Controlled image/video/music generation（人工审核后）
- Gallery / Daily archive 更新
- X / Blog publishing

---

## Phase History (Relevant to Mainline Recovery)

| Phase | Date | Focus | Status |
|-------|------|-------|--------|
| 1A–2C | 2026-06-10 | Initial asset repo setup, content packs | ✅ Complete |
| 3A–3E | 2026-06-11 | Image generation, gallery, quality review | ✅ Complete |
| 4A–4D | 2026-06-11 | Content pack enrichment, detail pages | ✅ Complete |
| 5A–5C | 2026-06-12 | Daily digest, promote gate, control server | ✅ Complete |
| C5M1 | 2026-06-14 | First controlled promote | ✅ Complete |
| C5N0–C5N6A | 2026-06-15 | Approval state, freeze, human decision, review | ❄️ Frozen |
| **6A** | **2026-06-15** | **Mainline recovery — return to content production** | **Active** |

---

*本文档定义了 Creative Quota Harvester 的主线目标。控制台主线（C5 系列）已冻结，内容主线（Signal → Asset）恢复正常优先级。*