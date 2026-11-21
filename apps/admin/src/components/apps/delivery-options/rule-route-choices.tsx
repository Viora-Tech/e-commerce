'use client'

import { Badge } from '@commerce/ui/shadcn/badge'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { FieldDescription } from '@commerce/ui/shadcn/field'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { deliveryRuleFormContent } from '@/data/delivery-rule-form'
import { useCopy } from '@/hooks/use-copy'
import { type RuleDraft, splitChip } from './rule-draft'
import type { RuleChip } from './rule-presets'
import { chipLabel } from './rule-preview'

type RuleRouteChoicesProps = {
  draft: RuleDraft
  chips: RuleChip[]
  onChange: (patch: Partial<RuleDraft>) => void
}

const CHEAPEST = 'cheapest'

/**
 * Step 3 of the product rule dialog, "Which courier is included in the price?": the cheapest,
 * or one of the ticked couriers (`defaultRoute`, shown first and marked Recommended), and
 * "Only this one, hide the others" (`forceRoute`). Owner, 20 Nov 2026.
 */
export default function RuleRouteChoices({ draft, chips, onChange }: RuleRouteChoicesProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)
  const form = useCopy(deliveryRuleFormContent)

  // Event handlers
  const handlePick = (v: string) =>
    onChange(v === CHEAPEST ? { preferred: null, forceRoute: false } : { preferred: v })

  // Render logic
  const t = form.included
  const ticked = chips.filter((c) => draft.chips.includes(c.id))
  // A rule saved with "Delhivery, any speed" keeps that choice.
  const saved = draft.preferred ? splitChip(draft.preferred) : null
  const anySpeed =
    saved?.speed === 'any' && draft.preferred
      ? [{ id: draft.preferred, label: copy.ruleDialog.preferredAny(chipLabel(saved, copy, form)) }]
      : []
  const items = [
    ...anySpeed,
    ...ticked.map((c) => ({ id: c.id, label: chipLabel(c, copy, form) })),
  ]
  const value = draft.preferred ?? CHEAPEST

  return (
    <div className="flex flex-col gap-3">
      <RadioGroup value={value} onValueChange={(v) => handlePick(String(v))}>
        <label htmlFor="rule-first-cheapest" className="flex cursor-pointer items-center gap-2 text-body">
          <RadioGroupItem id="rule-first-cheapest" value={CHEAPEST} />
          {t.cheapest}
        </label>
        {items.map((item) => (
          <label
            key={item.id}
            htmlFor={`rule-first-${item.id}`}
            className="flex cursor-pointer items-center gap-2 text-body"
          >
            <RadioGroupItem id={`rule-first-${item.id}`} value={item.id} />
            {item.label}
            {value === item.id ? <Badge variant="success">{t.recommended}</Badge> : null}
          </label>
        ))}
      </RadioGroup>
      <label
        htmlFor="rule-force-route"
        className="flex cursor-pointer items-start gap-2 text-body aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
        aria-disabled={draft.preferred === null || undefined}
      >
        <Checkbox
          id="rule-force-route"
          className="mt-0.5"
          checked={draft.forceRoute}
          disabled={draft.preferred === null}
          onCheckedChange={(v) => onChange({ forceRoute: Boolean(v) })}
        />
        <span className="flex flex-col gap-0.5">
          {t.onlyThis}
          <FieldDescription>{draft.preferred === null ? t.pickFirst : t.onlyThisHelp}</FieldDescription>
        </span>
      </label>
    </div>
  )
}
