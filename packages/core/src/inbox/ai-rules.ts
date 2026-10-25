/** SOURCE OF TRUTH: when the Inbox AI agent may answer — WHAT: `aiMayAnswer` (mode, availability, hand-off and staff take-over) and `asksForHuman` (English, Hindi, Hinglish asks for a person) / WHY: the worker and the admin's "AI is answering" label must agree, and a shopper who asks for a person never waits for a model. Pure: client components import it through `@commerce/core/inbox`. */
import type { InboxAiMode } from './settings'

export type AiAnswerFacts = {
  mode: InboxAiMode
  /** Staff show as online right now (`isInboxAvailable`). */
  staffAvailable: boolean
  status: 'open' | 'closed' | 'blocked'
  /** Already handed to a person: the AI stays quiet until staff close the conversation. */
  needsHuman: boolean
  /** A staff member has replied in this conversation: they took over (design §13). */
  staffReplied: boolean
}

/** Whether the AI agent answers the newest shopper message in a conversation. */
export function aiMayAnswer(f: AiAnswerFacts): boolean {
  if (f.mode === 'off' || f.status !== 'open' || f.needsHuman || f.staffReplied) return false
  return f.mode === 'all' || !f.staffAvailable
}

/*
 * Asks for a person, in English, Hindi (Devanagari) and Hinglish. Word-bounded where the script
 * has word boundaries; a match hands off straight away, without a model call.
 */
const HUMAN_PATTERNS = [
  /\b(talk|speak|chat|connect)\s+(to|with)\s+(a\s+)?(human|person|someone|agent|staff|team|owner|representative|real person)\b/i,
  /\b(human|real person|live agent|customer care|customer support|call me|callback)\b/i,
  /\b(insaan|aadmi|banda)\s+se\s+baat\b/i,
  /\bbaat\s+karw?a(o|do|na)\b/i,
  /इंसान|किसी\s*से\s*बात|बात\s*कराओ|कस्टमर\s*केयर|कॉल\s*करो/,
]

/** Whether a shopper's message asks to talk to a person. */
export function asksForHuman(text: string): boolean {
  return HUMAN_PATTERNS.some((p) => p.test(text))
}
