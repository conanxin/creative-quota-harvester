/**
 * src/pipeline/create-briefs.ts
 * Phase 2A: Generate Creative Briefs from selected signals
 *
 * Uses template-based generation (no MiniMax call).
 * MiniMax integration is Phase 2B.
 */
import { selectTopSignals, type SignalWithMeta } from "./select-top-signals";
import type { CreativeBrief, FactualBasis } from "../types/creative-brief";
import { generateId } from "../sources/utils";

const SOURCE_TYPE_LABELS: Record<string, string> = {
  "academic": "学术研究",
  "code": "开源项目",
  "dev-community": "开发者社区",
  "ai-ecosystem": "AI生态系统",
  "news": "新闻资讯",
  "context": "生活情境",
  "culture-art": "文化艺术",
};

const SOURCE_TYPE_ANGLES: Record<string, string[]> = {
  "academic": [
    "这篇论文揭示了AI领域的哪个前沿问题？",
    "研究方法有什么独特之处？",
    "对从业者有什么实际启发？",
  ],
  "code": [
    "这个开源项目解决了什么开发痛点？",
    "与其他类似项目相比有什么优势？",
    "适合哪些场景使用？",
  ],
  "dev-community": [
    "社区讨论反映了什么开发者趋势？",
    "有哪些实操经验值得分享？",
    "对AI辅助开发有什么启示？",
  ],
  "ai-ecosystem": [
    "这个模型/数据集代表了哪类AI能力的新高度？",
    "对AI应用开发有什么影响？",
    "开源生态中处于什么位置？",
  ],
  "culture-art": [
    "艺术品背后有什么文化故事？",
    "创作手法或主题有什么特别之处？",
    "与现代科技有什么交集？",
  ],
  "context": [
    "这个时间节点/天气/节气对生活有什么意义？",
    "有哪些可以结合AI创作的角度？",
  ],
};

const AUDIENCE_BY_TYPE: Record<string, string> = {
  "academic": "AI研究者、工程师、技术管理者",
  "code": "开发者、技术创业者、开源爱好者",
  "dev-community": "独立开发者、AI工具用户、技术社区",
  "ai-ecosystem": "AI应用开发者、研究者、技术爱好者",
  "culture-art": "创作者、艺术爱好者、文化研究者",
  "context": "普通用户、内容创作者、科技爱好者",
};

function generateTags(signal: SignalWithMeta): string[] {
  const tags = new Set<string>();
  tags.add(signal.source_type);
  // Parse from raw metadata if available
  try {
    const meta = typeof signal.metadata === "string" ? JSON.parse(signal.metadata) : signal.metadata;
    if (meta?.tags) {
      (meta.tags as string[]).forEach((t: string) => tags.add(t));
    }
    if (meta?.topics) {
      (meta.topics as string[]).forEach((t: string) => tags.add(t));
    }
  } catch { /* ignore parse errors */ }
  // Add from signal tags field
  if (signal.tags) {
    signal.tags.split(",").map(t => t.trim()).forEach(t => {
      if (t.length > 2 && t.length < 30) tags.add(t);
    });
  }
  return [...tags].slice(0, 15);
}

function buildFactualBasis(signals: SignalWithMeta[]): FactualBasis {
  const sources = signals.slice(0, 5);
  return {
    source_signal_ids: sources.map(s => s.id),
    source_types: [...new Set(sources.map(s => s.source_type))],
    source_titles: sources.map(s => s.title),
    source_urls: sources.map(s => s.url),
    key_facts: sources.map(s => {
      const summary = s.summary || "";
      return summary.length > 200 ? summary.slice(0, 200) + "…" : summary;
    }),
    source_confidence: sources.every(s => s.source_type !== "unknown") ? "high" : "medium",
  };
}

function generateWhyItMatters(signals: SignalWithMeta[]): string {
  if (signals.length === 0) return "信号数据不足以支撑分析。";
  const primary = signals[0];
  const typeLabel = SOURCE_TYPE_LABELS[primary.source_type] || primary.source_type;
  return `${typeLabel}领域动态：${primary.title}。`;
}

function generateContentAngle(signals: SignalWithMeta[]): string {
  if (signals.length === 0) return "待补充内容角度。";
  const primary = signals[0];
  const angles = SOURCE_TYPE_ANGLES[primary.source_type] || SOURCE_TYPE_ANGLES["code"];
  const angle = angles[Math.floor(Math.random() * angles.length)];
  return `${angle} — ${primary.title}`;
}

function generateUncertaintyNotes(signals: SignalWithMeta[]): string[] {
  const notes: string[] = [];
  if (signals.some(s => !s.url || s.url.length < 5)) {
    notes.push("部分信号缺少可靠的原始URL，需要人工核实。");
  }
  if (signals.some(s => s.final_score < 0.4)) {
    notes.push("部分信号评分较低，内容可能需要进一步验证。");
  }
  const types = new Set(signals.map(s => s.source_type));
  if (types.size === 1) {
    notes.push("信号来源单一，建议引入更多元化的信源以丰富内容角度。");
  }
  if (notes.length === 0) {
    notes.push("内容基于公开信号生成，事实部分需对照原始来源核实。");
  }
  return notes;
}

function generateRecommendedAssets(signals: SignalWithMeta[]): string[] {
  const types = new Set(signals.map(s => s.source_type));
  const assets = new Set<string>(["x-post"]); // always x-post
  if (types.has("code") || types.has("ai-ecosystem")) {
    assets.add("image");
    assets.add("webpage");
  }
  if (types.has("academic")) {
    assets.add("image");
    assets.add("webpage");
  }
  if (types.has("culture-art")) {
    assets.add("image");
    assets.add("video");
    assets.add("music");
  }
  if (types.has("dev-community")) {
    assets.add("x-post");
    assets.add("image");
  }
  return [...assets];
}

export function createBriefsFromSignals(options: {
  dbPath?: string;
  runId?: string;
  maxBriefs?: number;
  signalsPerBrief?: number;
}): { briefs: CreativeBrief[]; selection: ReturnType<typeof selectTopSignals> } {
  const { dbPath = "data/signals.db", maxBriefs = 5, signalsPerBrief = 3 } = options;

  const selection = selectTopSignals({ dbPath, runId: options.runId, maxSignals: 30 });
  const signals = selection.selected_signals;

  // Group by primary source_type for diverse coverage
  const byType = new Map<string, SignalWithMeta[]>();
  for (const s of signals) {
    const st = s.source_type || "unknown";
    if (!byType.has(st)) byType.set(st, []);
    byType.get(st)!.push(s);
  }

  // Build briefs ensuring coverage of different types
  const briefs: CreativeBrief[] = [];
  const usedTitles = new Set<string>();

  // Strategy: take1 top signal per type, build a brief around it
  const typeOrder = ["code", "academic", "ai-ecosystem", "dev-community", "culture-art", "context", "news"];
  for (const type of typeOrder) {
    if (briefs.length >= maxBriefs) break;
    const typeSignals = byType.get(type) || [];
    if (typeSignals.length === 0) continue;

    for (const primarySignal of typeSignals) {
      if (briefs.length >= maxBriefs) break;
      if (usedTitles.has(primarySignal.title)) continue;

      // Collect up to signalsPerBrief signals for this brief
      const briefSignals = [primarySignal];
      signals.forEach(s => {
        if (briefSignals.length >= signalsPerBrief) return;
        if (!briefSignals.includes(s) && s.source_type === primarySignal.source_type) {
          briefSignals.push(s);
        }
      });

      const tags = generateTags(primarySignal);
      const factual = buildFactualBasis(briefSignals);

      const brief: CreativeBrief = {
        id: generateId("brief"),
        title: primarySignal.title,
        source_signal_ids: briefSignals.map(s => s.id),
        source_types: [...new Set(briefSignals.map(s => s.source_type))],
        source_titles: briefSignals.map(s => s.title),
        source_urls: briefSignals.map(s => s.url),
        summary: primarySignal.summary || "",
        why_it_matters: generateWhyItMatters(briefSignals),
        content_angle: generateContentAngle(briefSignals),
        target_audience: AUDIENCE_BY_TYPE[primarySignal.source_type] || "技术爱好者",
        factual_basis: factual,
        uncertainty_notes: generateUncertaintyNotes(briefSignals),
        recommended_assets: generateRecommendedAssets(briefSignals),
        tags,
        final_score: primarySignal.final_score,
        created_at: new Date().toISOString(),
      };

      briefs.push(brief);
      usedTitles.add(primarySignal.title);
      break; // one brief per type
    }
  }

  return { briefs, selection };
}
// Phase 0A compatibility — re-export as default for run-once.ts
export default createBriefsFromSignals;
