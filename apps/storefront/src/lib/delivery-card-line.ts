/** SOURCE OF TRUTH: the fact line under a delivery card — WHAT: "By air · order in the next 2 h 14 min", "Surface · cash on delivery available", "By air · pay online for this option", built only from what the quote knows (how the route travels, today's dispatch cut-off, prepaid only, COD) / WHY: Figma 942:513's third line; a fact we do not know is left out, never guessed. Client-safe (no server imports). */
import { deliveryOptionsContent as appCopy } from '@/data/delivery-options'

type Mode = 'air' | 'express' | 'surface'

export type CardLineInput = {
  /** The card's title, so a mode it already names ("Blue Dart Air", "Surface") is not repeated. */
  title: string
  /** How the route travels; null when no route backs the card (zone rate). */
  mode: Mode | null
  /** The option takes cash on delivery; null when unknown (not a Delivery options card). */
  codAllowed: boolean | null
  /** Cash on delivery is a way to pay at this checkout at all. */
  codOffered: boolean
  /** Minutes left before today's dispatch cut-off, on the card that shows the countdown. */
  minutesLeft: number | null
}

/** The countdown shows only in the last hours before the cut-off, when it is useful urgency. */
export const COUNTDOWN_WINDOW_MINUTES = 6 * 60

const MODE_WORD: Record<Mode, RegExp> = {
  air: /\bair\b/i,
  express: /\bexpress\b/i,
  surface: /\bsurface\b/i,
}

/** Minutes until the cut-off instant, or null when there is none, it passed, or it is far off. */
export function minutesUntil(cutoffAt: string | null | undefined, nowMs: number): number | null {
  if (!cutoffAt) return null
  const at = Date.parse(cutoffAt)
  if (Number.isNaN(at)) return null
  const left = Math.ceil((at - nowMs) / 60_000)
  return left > 0 && left <= COUNTDOWN_WINDOW_MINUTES ? left : null
}

const sentence = (parts: string[]): string | null =>
  parts.length === 0
    ? null
    : parts
        .map((p, i) =>
          i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p.charAt(0).toLowerCase() + p.slice(1),
        )
        .join(' · ')

/**
 * The card's third line: mode, then the cut-off countdown, then how it can be paid for (prepaid
 * only, or COD available). At most three facts, so it stays one line on a computer.
 */
export function deliveryCardLine(i: CardLineInput): string | null {
  const parts: string[] = []
  if (i.mode && !MODE_WORD[i.mode].test(i.title)) parts.push(appCopy.mode[i.mode])
  if (i.minutesLeft !== null && i.minutesLeft > 0) {
    parts.push(appCopy.orderWithin(Math.floor(i.minutesLeft / 60), i.minutesLeft % 60))
  }
  if (i.codOffered && i.codAllowed === false) parts.push(appCopy.prepaidOnly)
  else if (i.codOffered && i.codAllowed === true && parts.length < 3)
    parts.push(appCopy.codAvailable)
  return sentence(parts)
}

/**
 * Which card counts down: the one that arrives first ("YYYY-MM-DD"), or the first card when
 * none arrives alone first. Returns its index.
 */
export function countdownIndex(earliest: ReadonlyArray<string | null>): number {
  const known = earliest.filter((e): e is string => e !== null)
  if (known.length === 0) return 0
  const first = [...known].sort()[0]
  const at = earliest.indexOf(first ?? null)
  return known.filter((e) => e === first).length === 1 && at >= 0 ? at : 0
}
