'use client'

import type { DeliveryOption } from '@commerce/core/delivery-options'
import { parseRupees } from '@commerce/money'
import { Badge } from '@commerce/ui/shadcn/badge'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { deliveryPagesContent } from '@/data/delivery-options-pages'
import { deliveryRuleFormContent } from '@/data/delivery-rule-form'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { RuleDraft } from './rule-draft'
import { chipLabel, rulePreview } from './rule-preview'
import { sampleCards, samplePackingPaise } from './rule-sample'

type RulePreviewLineProps = {
  draft: RuleDraft
  options: DeliveryOption[]
}

/**
 * "Shoppers will see" (owner, 20 Nov 2026): a small example courier list with a price next to
 * every courier ("Delhivery Air · Free · Recommended", "Blue Dart Air · + ₹49"), made-up costs
 * clearly labelled, and the rule in one plain sentence under it (#1781).
 */
export default function RulePreviewLine({ draft, options }: RulePreviewLineProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)
  const pages = useCopy(deliveryPagesContent)
  const form = useCopy(deliveryRuleFormContent)
  const fmt = useFormat()

  // Helpers
  /** "Free", "₹99" for the included courier; "+ ₹49" (or "₹148 (+ ₹49)") for a dearer one. */
  const priceText = (pricePaise: number, extraPaise: number, base: number, first: boolean) => {
    const t = form.sample
    if (pricePaise === 0) return t.free
    if (first || extraPaise === 0) return fmt.money(pricePaise)
    return base === 0
      ? t.extra(fmt.money(extraPaise))
      : t.total(fmt.money(pricePaise), fmt.money(extraPaise))
  }

  // Render logic
  const t = form.sample
  const names = new Map(options.map((o) => [o.id, o.name]))
  const preview = rulePreview(draft, copy, pages, form, names, fmt.money)
  const cards = draft.custom ? [] : sampleCards(draft)
  const base = cards[0]?.pricePaise ?? 0
  const freeAbove =
    draft.priceMode !== 'free' && draft.freeAboveOn ? parseRupees(draft.freeAbove) : null
  const packing = samplePackingPaise(draft)

  return (
    <section
      aria-live="polite"
      aria-label={t.title}
      className="flex flex-col gap-2 rounded-lg border border-info/30 bg-info-soft px-3 py-2.5"
    >
      <span className="text-caption font-medium text-info">{t.title}</span>
      {draft.custom ? null : cards.length === 0 ? (
        <span className="text-body text-muted-foreground">{t.empty}</span>
      ) : (
        <ul className="flex flex-col divide-y divide-hairline rounded-md border border-hairline bg-card">
          {cards.map((c, i) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2 text-body">
              <span className="flex items-center gap-2 text-ink-strong">
                {chipLabel(c, copy, form)}
                {c.recommended ? <Badge variant="success">{t.recommended}</Badge> : null}
              </span>
              <span className="font-medium text-ink-strong tabular-nums">
                {priceText(c.pricePaise, c.extraPaise, base, i === 0)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {cards.length > 0 ? (
        <span className="text-caption text-muted-foreground">
          {[
            t.example,
            packing > 0 ? t.packing(fmt.money(packing)) : null,
            freeAbove != null ? t.freeAbove(fmt.money(freeAbove)) : null,
            t.express,
          ]
            .filter(Boolean)
            .join(' ')}
        </span>
      ) : null}
      {preview ? <span className="text-body text-ink-strong">{preview.text}</span> : null}
      {preview?.off ? (
        <span className="text-caption text-muted-foreground">{pages.rulePreview.off}</span>
      ) : null}
    </section>
  )
}
