/** SOURCE OF TRUTH: catalog readiness — WHAT: how well AI agents can read each product / WHY: pure, so it is tested on its own */
/**
 * Figma "Catalog readiness": how well AI agents can read, match and recommend each product.
 * Pure, so it is tested on its own; `loadCatalogReadiness` feeds it the SEO report's product
 * scan and the store's published policies.
 */
import type { PolicyType } from '../policies/client'
import type { CatalogReadiness, ReadinessIssue, ReadinessPart, ReadinessSeverity } from './client'

export type ReadinessProduct = {
  id: string
  title: string
  bodyText: string
  imageCount: number
  vendor: string | null
  hasBarcode: boolean
  hasCategory: boolean
}

/** Agents want size, material and what it works with: this many words reads as complete. */
const FULL_DESCRIPTION_WORDS = 40
/** Under this a description is too thin to match a question at all. */
const MIN_DESCRIPTION_WORDS = 15
/** Agents show a gallery; fewer than this is flagged. */
const MIN_IMAGES = 3

const POLICY_RULES: {
  type: PolicyType
  rule: ReadinessIssue['rule']
  severity: ReadinessSeverity
  fix: ReadinessIssue['fix']
}[] = [
  { type: 'refund-policy', rule: 'no_refund_policy', severity: 'high', fix: 'policy' },
  { type: 'shipping-policy', rule: 'no_shipping_policy', severity: 'medium', fix: 'shipping' },
  { type: 'terms-of-service', rule: 'no_terms', severity: 'low', fix: 'policy' },
]

const RANK: Record<ReadinessSeverity, number> = { high: 0, medium: 1, low: 2 }

const words = (text: string) => text.split(/\s+/).filter(Boolean).length

const mean = (values: number[]) =>
  values.length === 0 ? 1 : values.reduce((a, b) => a + b, 0) / values.length

/** The readiness report over the live products and the published policies. */
export function catalogReadiness(
  products: readonly ReadinessProduct[],
  publishedPolicies: readonly PolicyType[],
): CatalogReadiness {
  const issues: ReadinessIssue[] = []
  const aiFixable: string[] = []
  const details: number[] = []
  const descriptions: number[] = []
  const images: number[] = []

  for (const p of products) {
    const base = { kind: 'product' as const, title: p.title, ref: p.id }
    const n = words(p.bodyText)
    descriptions.push(n >= FULL_DESCRIPTION_WORDS ? 1 : n >= MIN_DESCRIPTION_WORDS ? 0.5 : 0)
    if (n < FULL_DESCRIPTION_WORDS) aiFixable.push(p.id)
    if (n === 0)
      issues.push({
        ...base,
        id: `${p.id}:desc`,
        severity: 'high',
        rule: 'no_description',
        fix: 'ai',
      })
    else if (n < MIN_DESCRIPTION_WORDS)
      issues.push({
        ...base,
        id: `${p.id}:desc`,
        severity: 'high',
        rule: 'short_description',
        fix: 'ai',
        n,
      })
    else if (n < FULL_DESCRIPTION_WORDS)
      issues.push({
        ...base,
        id: `${p.id}:desc`,
        severity: 'medium',
        rule: 'short_description',
        fix: 'ai',
        n,
      })

    const hasBrand = Boolean(p.vendor?.trim())
    details.push(((hasBrand ? 1 : 0) + (p.hasBarcode ? 1 : 0) + (p.hasCategory ? 1 : 0)) / 3)
    if (!hasBrand && !p.hasBarcode)
      issues.push({
        ...base,
        id: `${p.id}:gtin`,
        severity: 'high',
        rule: 'no_identifier',
        fix: 'gtin',
      })
    if (!p.hasCategory)
      issues.push({
        ...base,
        id: `${p.id}:cat`,
        severity: 'low',
        rule: 'no_category',
        fix: 'attributes',
      })

    images.push(Math.min(p.imageCount, MIN_IMAGES) / MIN_IMAGES)
    if (p.imageCount === 0)
      issues.push({
        ...base,
        id: `${p.id}:img`,
        severity: 'high',
        rule: 'no_images',
        fix: 'images',
      })
    else if (p.imageCount < MIN_IMAGES)
      issues.push({
        ...base,
        id: `${p.id}:img`,
        severity: 'medium',
        rule: 'few_images',
        fix: 'images',
        n: p.imageCount,
      })
  }

  const policies: number[] = []
  for (const rule of POLICY_RULES) {
    const has = publishedPolicies.includes(rule.type)
    policies.push(has ? 1 : 0)
    if (!has)
      issues.push({
        id: `policy:${rule.type}`,
        kind: 'policy',
        title: rule.type,
        ref: rule.type,
        severity: rule.severity,
        rule: rule.rule,
        fix: rule.fix,
      })
  }

  const parts: Record<ReadinessPart, number> = {
    details: Math.round(mean(details) * 100),
    descriptions: Math.round(mean(descriptions) * 100),
    images: Math.round(mean(images) * 100),
    policies: Math.round(mean(policies) * 100),
  }
  issues.sort((a, b) => RANK[a.severity] - RANK[b.severity] || a.title.localeCompare(b.title))
  const counts = { high: 0, medium: 0, low: 0 }
  for (const i of issues) counts[i.severity] += 1

  return {
    score: Math.round((parts.details + parts.descriptions + parts.images + parts.policies) / 4),
    parts,
    products: products.length,
    counts,
    issues,
    aiFixable,
  }
}
