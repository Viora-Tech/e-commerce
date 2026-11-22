'use client'

import type { RouteRule } from '@commerce/core/delivery-options'
import { Button } from '@commerce/ui/shadcn/button'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { deliveryRuleFormContent } from '@/data/delivery-rule-form'
import { useCopy } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { type CollectionTwin, carrierName } from './format'
import InlineWarning from './inline-warning'
import { blockingRules, orderAdvice, sortBySpecificity } from './rule-order'

type RuleOrderCardProps = {
  rules: RouteRule[]
  /** Saves the sorted order (the page's drag-to-reorder save). */
  onSort: (next: RouteRule[]) => void
}

/**
 * Under the Product rules list (owner, 20 Nov 2026): which rule should sit above which and why
 * ("Mice (a collection) above All products"), "Sort by most specific", and rules that can block
 * delivery (one courier only; an All products rule with one courier; a collection named like a
 * ruled one that the rule misses). Hidden when there is nothing to say.
 */
export default function RuleOrderCard({ rules, onSort }: RuleOrderCardProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)
  const form = useCopy(deliveryRuleFormContent)
  const { data, failed } = useLoad(
    async () => (rules.length === 0 ? null : api.deliveryOptions.collectionTwins()),
    [rules],
  )
  // A failed read shows no twins.
  const twins: CollectionTwin[] = failed ? [] : (data ?? [])

  // Helpers
  const named = (r: RouteRule) => form.order.named(r.name, form.order.kinds[r.target.kind])

  // Early returns
  const advice = orderAdvice(rules)
  const warnings = blockingRules(rules)
  if (advice.length === 0 && warnings.length === 0 && twins.length === 0) return null

  // Render logic
  const t = form.order

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-panel-border bg-card p-4">
      {advice.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-body font-semibold text-ink-strong">{t.title}</h2>
            <Button variant="outline" size="sm" onClick={() => onSort(sortBySpecificity(rules))}>
              {t.sort}
            </Button>
          </div>
          <p className="text-caption text-muted-foreground">{t.why}</p>
          <ul className="flex flex-col gap-1 text-body text-ink-strong">
            {advice.map((a) => (
              <li key={`${a.specific.id}-${a.broad.id}`}>
                {t.moveAbove(named(a.specific), named(a.broad))}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {warnings.length > 0 || twins.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-body font-semibold text-ink-strong">{t.warnings.title}</h2>
          {warnings.map((w) =>
            w.kind === 'separateParcels' ? (
              <InlineWarning key={`${w.rule.id}-${w.other.id}`}>
                {t.warnings.separateParcels(w.rule.name, w.other.name)}
              </InlineWarning>
            ) : (
              <InlineWarning key={w.rule.id}>
                {t.warnings[w.kind](
                  w.rule.name,
                  carrierName(w.carrier, copy.routeDialog.anyCourier),
                )}
              </InlineWarning>
            ),
          )}
          {twins.map((tw) => (
            <InlineWarning key={`${tw.ruleId}-${tw.other.id}`}>
              {t.warnings.twin(tw.ruleName, tw.ruled.title, tw.other.title, tw.missing)}
            </InlineWarning>
          ))}
        </div>
      ) : null}
    </section>
  )
}
