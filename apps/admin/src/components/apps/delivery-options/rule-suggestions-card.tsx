'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { deliveryRuleFormContent } from '@/data/delivery-rule-form'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import type { RuleSuggestion } from './format'

type RuleSuggestionsCardProps = {
  /** Bumped when rules change, so a suggestion a new rule covers goes away. */
  version: number
  onAdd: (suggestion: RuleSuggestion) => void
}

/**
 * "Suggested from your shipping rates" on the Product rules page (owner, 20 Nov 2026): each
 * shipping profile as a rule to add ("Skates · 33 products · ₹99 – ₹139 → Fixed ₹99"). Add rule
 * opens the dialog filled in; nothing is saved until the owner saves it. Hidden with none.
 */
export default function RuleSuggestionsCard({ version, onAdd }: RuleSuggestionsCardProps) {
  // Hooks
  const form = useCopy(deliveryRuleFormContent)
  const fmt = useFormat()
  const { data, failed } = useLoad(() => api.deliveryOptions.ruleSuggestions(), [version])
  // A failed read shows no suggestions.
  const items: RuleSuggestion[] = failed ? [] : (data ?? [])

  // Helpers
  const priceLabel = (s: RuleSuggestion) => {
    const p = form.suggestions.price
    const main =
      s.price.mode === 'free'
        ? p.free
        : s.price.mode === 'fixed'
          ? p.fixed(fmt.money(s.price.fixedPaise ?? 0))
          : p.option
    const above = s.price.freeAbovePaise
    return above != null && s.price.mode !== 'free'
      ? `${main}, ${p.freeAbove(fmt.money(above))}`
      : main
  }

  // Early returns
  if (items.length === 0) return null

  // Render logic
  const t = form.suggestions

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-panel-border bg-card p-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-body font-semibold text-ink-strong">{t.title}</h2>
        <p className="text-caption text-muted-foreground">{t.help}</p>
      </div>
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {items.map((s) => (
          <li
            key={s.profileId}
            className="flex items-center justify-between gap-3 rounded-lg border border-hairline px-3 py-2.5"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-body font-medium text-ink-strong">{s.name}</span>
              <span className="text-caption text-muted-foreground">
                {[
                  s.target.kind === 'all' ? t.allProducts : t.products(s.target.values.length),
                  s.lowestPaise != null && s.highestPaise != null
                    ? t.rates(fmt.money(s.lowestPaise), fmt.money(s.highestPaise))
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              <span className="text-caption font-medium text-ink-strong">{priceLabel(s)}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => onAdd(s)}>
              {t.add}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
