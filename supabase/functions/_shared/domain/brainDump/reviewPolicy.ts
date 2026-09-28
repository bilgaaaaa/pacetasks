import type { BrainDumpCandidate, ReviewReason } from "./types.ts";

// Thresholds deciding when a brain dump must be reviewed before tasks are created.
export const BRAIN_DUMP_REVIEW_POLICY = {
  minConfidence: 0.75,
  maxAutoCreateCandidates: 8,
} as const;

export interface ReviewDecision {
  needsReview: boolean;
  reasons: ReviewReason[];
}

// Deterministic gate for automatic creation: any issue, too many tasks, or text
// the AI couldn't place means the user reviews first.
export function decideReview(
  candidates: BrainDumpCandidate[],
  unparsedFragments: string[]
): ReviewDecision {
  const reasons: ReviewReason[] = [];

  if (candidates.length === 0) reasons.push("no_candidates");
  if (candidates.some((candidate) => candidate.issues.length > 0)) reasons.push("candidate_issues");
  if (candidates.length > BRAIN_DUMP_REVIEW_POLICY.maxAutoCreateCandidates) {
    reasons.push("too_many_candidates");
  }
  if (unparsedFragments.some((fragment) => fragment.trim().length > 0)) reasons.push("unparsed_text");

  return { needsReview: reasons.length > 0, reasons };
}
