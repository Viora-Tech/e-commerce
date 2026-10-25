/**
 * A section's "A/B test" setting (the GrowthBook app): show the section only in one variant of
 * an experiment. Stored on the section as `settings.experiment`; the storefront applies it
 * before rendering (`apps/storefront/src/lib/template-render.tsx`).
 */

/** The experiment's tracking key and the variant (`0` or `control`, `1`, or a variation's name). */
export type SectionExperiment = { key: string; variant: string }

/** Longest experiment key or variant kept. */
const EXPERIMENT_TEXT_MAX = 100

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** A stored experiment setting, trimmed; null when it names no experiment. */
export function cleanExperiment(value: unknown): SectionExperiment | null {
  if (!isRecord(value) || typeof value.key !== 'string') return null
  const key = value.key.trim().slice(0, EXPERIMENT_TEXT_MAX)
  if (!key) return null
  const variant =
    typeof value.variant === 'string' ? value.variant.trim().slice(0, EXPERIMENT_TEXT_MAX) : ''
  return { key, variant }
}

/**
 * The experiment a section is shown in, read straight from its saved props (`settings.experiment`)
 * without migrating them; null for a section everyone sees.
 */
export function sectionExperimentGate(props: { settings?: unknown }): SectionExperiment | null {
  return isRecord(props.settings) ? cleanExperiment(props.settings.experiment) : null
}

/** The "A/B test" settings group every section offers. */
export const EXPERIMENT_GROUP = {
  type: 'object',
  label: 'A/B test',
  objectFields: {
    key: { type: 'text', label: 'Experiment key (blank: everyone sees it)' },
    variant: { type: 'text', label: 'Show to variant (0 = control, 1, 2…)' },
  },
} as const
