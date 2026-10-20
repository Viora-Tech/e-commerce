import { type FeatureApiResponse, GrowthBookClient } from '@growthbook/growthbook'

/**
 * Server-side assignment with GrowthBook's own SDK (`@growthbook/growthbook`, MIT): the
 * storefront evaluates every feature of the store's SDK connection for the shopper's anonymous
 * id and keeps the experiments the shopper is in, so a page renders its variant on the server
 * (no flicker, nothing for the browser to fetch). Experiments are GrowthBook feature flags with
 * an "Experiment" rule; the experiment's tracking key is what sections and Liquid name.
 */

/** The variation one shopper sees in one experiment. */
export type ExperimentAssignment = {
  /** The experiment's tracking key. */
  key: string
  /** 0 is the control, 1 the first variant, and so on. */
  variationId: number
  /** The variation's key in GrowthBook (`"0"`, `"1"` unless renamed). */
  variationKey: string
  /** The variation's name, when GrowthBook sent one. */
  name: string
}

/** Assignments by experiment tracking key. */
export type Assignments = Readonly<Record<string, ExperimentAssignment>>

export const NO_ASSIGNMENTS: Assignments = Object.freeze({})

/** One store's features, ready to evaluate for any shopper. */
export type FeatureEvaluator = {
  /** The experiments `visitorId` is in. */
  assign(visitorId: string, extra?: { url?: string | undefined }): Assignments
}

/**
 * An evaluator for an SDK connection's payload (decrypted with `decryptionKey` when the
 * connection encrypts its features). Build one per payload and reuse it for every shopper.
 */
export async function featureEvaluator(
  payload: Record<string, unknown>,
  decryptionKey = '',
): Promise<FeatureEvaluator> {
  const client = new GrowthBookClient(decryptionKey ? { decryptionKey } : {})
  await client.setPayload(payload as FeatureApiResponse)
  const featureKeys = Object.keys(client.getDecryptedPayload().features ?? {})
  return {
    assign(visitorId, extra = {}) {
      const out: Record<string, ExperimentAssignment> = {}
      const user = { attributes: { id: visitorId }, ...(extra.url ? { url: extra.url } : {}) }
      for (const featureKey of featureKeys) {
        const result = client.evalFeature(featureKey, user)
        const exp = result.experiment
        const res = result.experimentResult
        if (!exp || !res?.inExperiment || out[exp.key]) continue
        out[exp.key] = {
          key: exp.key,
          variationId: res.variationId,
          variationKey: res.key,
          name: res.name ?? exp.meta?.[res.variationId]?.name ?? '',
        }
      }
      return out
    },
  }
}

/** A section's "Show only in an experiment variant" setting; a blank key shows it to everyone. */
export type ExperimentGate = { key: string; variant: string }

const CONTROL_NAMES = new Set(['0', 'control'])

/**
 * Whether a gated section shows for these assignments. The variant may be typed as the
 * variation's number (`0`, `1`), its key or its name, any case; `control` means 0. A shopper
 * outside the experiment (no consent, not in its traffic, the experiment stopped) sees the
 * control, so a section for the control shows and a section for a variant does not.
 */
export function variantMatches(gate: ExperimentGate, assignments: Assignments): boolean {
  const key = gate.key.trim()
  if (!key) return true
  const wanted = gate.variant.trim().toLowerCase()
  const assigned = Object.hasOwn(assignments, key) ? assignments[key] : undefined
  if (!assigned) return wanted === '' || CONTROL_NAMES.has(wanted)
  if (wanted === '') return assigned.variationId === 0
  if (assigned.variationId === 0 && CONTROL_NAMES.has(wanted)) return true
  return (
    wanted === String(assigned.variationId) ||
    wanted === assigned.variationKey.toLowerCase() ||
    (assigned.name !== '' && wanted === assigned.name.toLowerCase())
  )
}

/** `request.experiments` for Liquid: tracking key → variation number. */
export function liquidExperiments(assignments: Assignments): Record<string, number> {
  return Object.fromEntries(Object.values(assignments).map((a) => [a.key, a.variationId]))
}

/** A short, stable label of the assignments for cache keys (`a=1;b=0`); blank when none. */
export function assignmentsKey(assignments: Assignments): string {
  return Object.values(assignments)
    .map((a) => `${a.key}=${a.variationId}`)
    .sort()
    .join(';')
}

/**
 * A per-key cache of loaded values for `ttlMs` (the storefront keeps each store's evaluator for
 * a minute). A failed load is remembered as null for the same time, so a GrowthBook outage costs
 * one slow request a minute, not one per page view. Loads for one key share one promise.
 */
export function ttlCache<T>(ttlMs: number, now: () => number = Date.now) {
  const entries = new Map<string, { at: number; value: Promise<T | null> }>()
  return {
    get(key: string, load: () => Promise<T>): Promise<T | null> {
      const hit = entries.get(key)
      if (hit && now() - hit.at < ttlMs) return hit.value
      const value = load().catch(() => null)
      entries.set(key, { at: now(), value })
      // Drop entries long past their time, so a removed store's evaluator does not linger.
      if (entries.size > 500) {
        for (const [k, e] of entries) if (now() - e.at >= ttlMs) entries.delete(k)
      }
      return value
    },
  }
}
