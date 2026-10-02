/**
 * Per-message state the assistant's tools share: whether a tool read store text that looked
 * like instructions to the AI (then every proposal after it carries a warning), and how many
 * proposals this message made (capped by ASSISTANT_LIMITS.maxProposalsPerTurn).
 */
export type Taint = { flagged: boolean; proposals: number }

export function freshTaint(): Taint {
  return { flagged: false, proposals: 0 }
}
