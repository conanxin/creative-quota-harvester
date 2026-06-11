/**
 * generation-guard.ts — Phase 3C
 * 
 * Gatekeeper for all real MiniMax generation calls.
 * Default policy: DENY unless all conditions are met.
 * 
 * Conditions for ALLOW:
 * 1. media_type is explicitly "image" / "music" / "video"
 * 2. max_count is explicitly set and within limits
 * 3. confirm_spend === true
 * 4. CQA_ALLOW_GENERATION=1 or --confirm-spend flag
 * 5. Quota guard passes (via minimax-quota-guard.ts)
 * 
 * Always DENY if:
 * - Command is "继续" / "continue" / "下一步" / "run next" / "go" / "执行"
 * - media_type is ambiguous or missing
 * - max_count > max allowed per policy
 * - confirm_spend is not explicitly true
 */

export interface GenerationRequest {
  media_type: 'image' | 'music' | 'video' | null;
  max_count: number;
  confirm_spend: boolean;
  dry_run: boolean;
  command_hint?: string; // original command text for ambiguity detection
}

export interface GenerationDecision {
  decision: 'ALLOW' | 'DENY' | 'ALLOW_DRY_RUN';
  reason: string;
  media_type?: string;
  max_count?: number;
}

// Ambiguous command patterns that MUST trigger DENY
const AMBIGUOUS_PATTERNS = [
  '继续', 'continue', '下一步', 'run next', 'go', '执行',
  '运行', 'start', 'begin', 'proceed',
];

// Per-media type limits
const LIMITS = {
  image: { max: 2, enabled: true },
  music: { max: 0, enabled: false },
  video: { max: 0, enabled: false },
};

function isAmbiguousCommand(cmd: string | undefined): boolean {
  if (!cmd) return false;
  const lower = cmd.toLowerCase().trim();
  return AMBIGUOUS_PATTERNS.some(p => lower === p.toLowerCase() || lower.includes(p.toLowerCase()));
}

export function evaluateGeneration(request: GenerationRequest): GenerationDecision {
  const { media_type, max_count, confirm_spend, dry_run, command_hint } = request;

  // Rule 1: Block ambiguous commands
  if (isAmbiguousCommand(command_hint)) {
    return {
      decision: 'DENY',
      reason: 'Ambiguous command. Use explicit generation command: "Generate N images for [content pack]".',
    };
  }

  // Rule 2: Must have explicit media_type
  if (!media_type) {
    return {
      decision: 'DENY',
      reason: 'No media_type specified. Generation requires explicit type: image, music, or video.',
    };
  }

  // Rule 3: Must have confirm_spend = true (unless dry_run)
  if (!confirm_spend && !dry_run) {
    return {
      decision: 'DENY',
      reason: `confirm_spend=false. Real generation requires explicit confirmation (confirm_spend=true). Use dry-run mode instead.`,
    };
  }

  // Rule 4: Check media type is enabled
  const limit = LIMITS[media_type as keyof typeof LIMITS];
  if (!limit || !limit.enabled) {
    return {
      decision: 'DENY',
      reason: `${media_type} generation is disabled by default. Explicit opt-in required.`,
    };
  }

  // Rule 5: Check count limits
  if (max_count > limit.max) {
    return {
      decision: 'DENY',
      reason: `max_count=${max_count} exceeds limit (${limit.max}) for ${media_type}. Reduce count and retry.`,
    };
  }

  if (max_count < 1) {
    return {
      decision: 'DENY',
      reason: `max_count must be >= 1.`,
    };
  }

  // Rule 6: dry_run always allowed (if other checks pass)
  if (dry_run) {
    return {
      decision: 'ALLOW_DRY_RUN',
      reason: `Dry-run allowed. media_type=${media_type}, max_count=${max_count}.`,
      media_type,
      max_count,
    };
  }

  // All checks passed — real generation allowed
  return {
    decision: 'ALLOW',
    reason: `Generation allowed: ${media_type} x ${max_count}. Quota guard must also pass.`,
    media_type,
    max_count,
  };
}

export function checkEnvFlag(): boolean {
  return process.env.CQA_ALLOW_GENERATION === '1';
}
