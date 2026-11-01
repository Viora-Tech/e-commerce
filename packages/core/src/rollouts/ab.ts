/** SOURCE OF TRUTH: A/B rollout maths — assignArm, abBucket, twoProportionZ, abVerdict
 * WHAT:  Which arm a visitor of an A/B rollout sees, worked out from the visitor id hashed with
 *        the rollout id (no stored assignment, the same answer on every server and every page),
 *        and the hint the results card shows from a two-proportion z-test on conversion.
 * WHY:   Sticky without a cookie of its own: the anonymous visitor id (`wc_vid`) already exists
 *        after a yes to analytics. Pure, so the storefront, the admin and the tests share it.
 */

export type Arm = 'control' | 'treatment'

/** FNV-1a, 32 bit: fast, stable, spreads close ids apart (GrowthBook hashes the same way). */
export function fnv1a32(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/** MurmurHash3's finaliser: FNV-1a alone leaves ids that differ in their last digits close. */
function mix32(h: number): number {
  let x = h
  x ^= x >>> 16
  x = Math.imul(x, 0x85ebca6b) >>> 0
  x ^= x >>> 13
  x = Math.imul(x, 0xc2b2ae35) >>> 0
  x ^= x >>> 16
  return x >>> 0
}

/** A visitor's place in [0, 1) for one rollout; `salt` keeps the traffic and arm draws apart. */
export function abBucket(rolloutId: string, visitorId: string, salt: string): number {
  return mix32(fnv1a32(`${salt}|${rolloutId}|${visitorId}`)) / 2 ** 32
}

export type ArmInput = {
  rolloutId: string
  visitorId: string | null
  /** Share of all visitors in the test, 1–100. */
  traffic: number
  /** Treatment's share of the tested visitors, 1–99. */
  split: number
  /** A crawler: always sees the Control, never counted. */
  bot?: boolean
}

/**
 * The arm a visitor sees, or null when they are not in the test (no visitor id, a bot, outside
 * the traffic): they see the store as it is and are not counted. Raising the traffic only adds
 * visitors, and the split draw is separate, so nobody already in the test changes arm.
 */
export function assignArm(input: ArmInput): Arm | null {
  if (!input.visitorId || input.bot) return null
  if (abBucket(input.rolloutId, input.visitorId, 'traffic') >= input.traffic / 100) return null
  return abBucket(input.rolloutId, input.visitorId, 'arm') < input.split / 100
    ? 'treatment'
    : 'control'
}

/** One arm's numbers: visitors reached and how many of them converted. */
export type ArmCounts = { visitors: number; conversions: number }

/** z for "Treatment converts better than Control" (pooled two-proportion test); 0 without data. */
export function twoProportionZ(control: ArmCounts, treatment: ArmCounts): number {
  const n1 = control.visitors
  const n2 = treatment.visitors
  if (n1 <= 0 || n2 <= 0) return 0
  const p1 = control.conversions / n1
  const p2 = treatment.conversions / n2
  const pooled = (control.conversions + treatment.conversions) / (n1 + n2)
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2))
  return se === 0 ? 0 : (p2 - p1) / se
}

/** Fewest visitors per arm and conversions in all before the card names a leader. */
export const AB_MIN_VISITORS = 100
export const AB_MIN_CONVERSIONS = 10

export type AbVerdict =
  | { kind: 'not_enough' }
  | { kind: 'no_difference' }
  | { kind: 'ahead'; arm: Arm; confidence: 90 | 95 | 99 }

/** "Not enough data yet", "no clear winner", or which arm leads at ~90/95/99% (two-sided). */
export function abVerdict(control: ArmCounts, treatment: ArmCounts): AbVerdict {
  if (
    control.visitors < AB_MIN_VISITORS ||
    treatment.visitors < AB_MIN_VISITORS ||
    control.conversions + treatment.conversions < AB_MIN_CONVERSIONS
  ) {
    return { kind: 'not_enough' }
  }
  const z = twoProportionZ(control, treatment)
  const size = Math.abs(z)
  const confidence = size >= 2.576 ? 99 : size >= 1.96 ? 95 : size >= 1.645 ? 90 : null
  if (confidence === null) return { kind: 'no_difference' }
  return { kind: 'ahead', arm: z > 0 ? 'treatment' : 'control', confidence }
}

/** A share in [0, 1]; 0 with nobody to divide by. */
export const abRate = (part: number, whole: number): number => (whole > 0 ? part / whole : 0)
