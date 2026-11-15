/**
 * Late checks on approving an AI proposal, which stays open up to a day (#1717): a product text
 * update applies only the fields nobody edited since it was proposed (tags as a delta on today's
 * tags), and a discount whose dates went stale is refused.
 */
import type { ProductFieldsPatch, ProductFieldsSnapshot } from '@commerce/core'
import { listed, ProposalProblem, shortDay } from './resolve'
import type { ActionEnv } from './types'

export type TextField = 'title' | 'description' | 'seoTitle' | 'seoDescription'

export type ProductUpdateResolved = {
  productId: string
  title: string
  patch: ProductFieldsPatch
  /** Each text field as it was when proposed; absent on proposals made before 15 Nov 2026. */
  before?: Partial<Record<TextField, unknown>>
  /** The tag change as a delta, applied to the tags the product has at approval. */
  tags?: { add: string[]; remove: string[] }
}
const TEXT_FIELDS: readonly { key: TextField; label: string }[] = [
  { key: 'title', label: 'title' },
  { key: 'description', label: 'description' },
  { key: 'seoTitle', label: 'search title' },
  { key: 'seoDescription', label: 'search description' },
]

/** JSON with sorted keys, so a description read back from jsonb compares equal. */
function canonical(value: unknown): string {
  return JSON.stringify(value ?? null, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  )
}

/** Today's tags with the proposal's delta applied (case-insensitive, at most 50). */
function applyTagDelta(tags: string[], delta: { add: string[]; remove: string[] }): string[] {
  const remove = new Set(delta.remove.map((t) => t.toLowerCase()))
  const kept = tags.filter((t) => !remove.has(t.toLowerCase()))
  const have = new Set(kept.map((t) => t.toLowerCase()))
  return [...kept, ...delta.add.filter((t) => !have.has(t.toLowerCase()))].slice(0, 50)
}

/**
 * What approve writes: each text field only while it still holds the value it had when
 * proposed, and the tag delta on today's tags. `edited` are fields someone changed since,
 * `already` ones that hold the proposed value now. Proposals without `before` apply as proposed.
 */
export function latePatch(
  resolved: ProductUpdateResolved,
  now: ProductFieldsSnapshot,
): { patch: ProductFieldsPatch; applied: string[]; edited: string[]; already: string[] } {
  const patch: ProductFieldsPatch = {}
  const out = { applied: [] as string[], edited: [] as string[], already: [] as string[] }
  for (const { key, label } of TEXT_FIELDS) {
    if (!(key in resolved.patch)) continue
    const current = canonical(now[key])
    if (current === canonical(resolved.patch[key])) out.already.push(label)
    else if (!resolved.before || current === canonical(resolved.before[key])) {
      Object.assign(patch, { [key]: resolved.patch[key] })
      out.applied.push(label)
    } else out.edited.push(label)
  }
  if (resolved.patch.tags) {
    const tags = resolved.tags ? applyTagDelta(now.tags, resolved.tags) : resolved.patch.tags
    if (tags.join('|') === now.tags.join('|')) out.already.push('tags')
    else {
      patch.tags = tags
      out.applied.push('tags')
    }
  }
  return { patch, ...out }
}

/** "search title was edited after this was proposed; tags already match". */
export function lateNote(edited: string[], already: string[]): string {
  return [
    edited.length
      ? `${listed(edited, 4)} ${edited.length === 1 ? 'was' : 'were'} edited after this was proposed`
      : null,
    already.length
      ? `${listed(already, 4)} already ${already.length === 1 ? 'matches' : 'match'}`
      : null,
  ]
    .filter(Boolean)
    .join('; ')
}

/**
 * A proposal waits up to a day: on approve, refuse a discount whose last day has passed
 * meanwhile, or whose dates no longer make sense, instead of creating a dead code.
 */
export function lateDateCheck(
  env: Pick<ActionEnv, 'now' | 'store'>,
  d: { code?: string | null | undefined; startsAt?: unknown; endsAt?: unknown },
): void {
  const at = (v: unknown) => (v ? new Date(v as string | Date) : null)
  const startsAt = at(d.startsAt)
  const endsAt = at(d.endsAt)
  const code = d.code ?? 'This discount'
  if (endsAt && startsAt && endsAt.getTime() <= startsAt.getTime()) {
    throw new ProposalProblem(
      `${code} was not created: it would end (${shortDay(env, endsAt)}) before it starts (${shortDay(env, startsAt)}). Ask again with new dates.`,
    )
  }
  if (endsAt && endsAt.getTime() < env.now.getTime()) {
    throw new ProposalProblem(
      `${code} was not created: its last day (${shortDay(env, endsAt)}) passed while it waited for approval. Ask again with new dates.`,
    )
  }
}
