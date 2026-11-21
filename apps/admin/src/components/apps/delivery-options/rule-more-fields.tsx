'use client'

import type { DeliveryOption } from '@commerce/core/delivery-options'
import { ChevronDown } from '@commerce/ui/icons'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@commerce/ui/shadcn/collapsible'
import { FieldLabel } from '@commerce/ui/shadcn/field'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { useCopy } from '@/hooks/use-copy'
import { type RuleDraft, THROUGH, THROUGH_OFFERED, type Through } from './rule-draft'

type RuleMoreFieldsProps = {
  draft: RuleDraft
  options: DeliveryOption[]
  onChange: (patch: Partial<RuleDraft>) => void
}

const isThrough = (v: string): v is Through => THROUGH.some((t) => t === v)

/**
 * The rule dialog's collapsed "More" (#1781): always insure these products (insurance
 * `required`), apply the rule only to some options, like Standard (`optionIds`), and Through
 * (own account, RapidShyp, Shiprocket or either; moved here on 20 Nov 2026). Opens by itself
 * when the rule already uses any of them.
 */
export default function RuleMoreFields({ draft, options, onChange }: RuleMoreFieldsProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)

  // Event handlers
  const handleOption = (id: string, on: boolean) => {
    const current = draft.optionIds === 'all' ? [] : draft.optionIds
    const next = on ? [...current, id] : current.filter((x) => x !== id)
    onChange({ optionIds: next.length ? next : 'all' })
  }

  // Render logic
  const d = copy.ruleDialog
  const used =
    draft.insurance === 'required' || draft.optionIds !== 'all' || draft.through !== 'any'
  const through = THROUGH_OFFERED.includes(draft.through)
    ? THROUGH_OFFERED
    : THROUGH.filter((t) => THROUGH_OFFERED.includes(t) || t === draft.through)

  return (
    <Collapsible defaultOpen={used} className="rounded-lg border border-panel-border">
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-3 py-2.5 text-body font-medium text-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {d.more}
        <ChevronDown
          aria-hidden
          className="size-4 text-muted-foreground transition-[rotate] duration-150 ease-out group-data-[panel-open]:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-4 border-t border-hairline px-3 py-3">
        <label htmlFor="rule-insure" className="flex cursor-pointer items-center gap-2 text-body">
          <Checkbox
            id="rule-insure"
            checked={draft.insurance === 'required'}
            onCheckedChange={(v) => onChange({ insurance: v ? 'required' : 'follow_option' })}
          />
          {d.alwaysInsure}
        </label>
        <div className="flex flex-col gap-2">
          <FieldLabel>{d.applyTo}</FieldLabel>
          <label
            htmlFor="rule-all-options"
            className="flex cursor-pointer items-center gap-2 text-body"
          >
            <Checkbox
              id="rule-all-options"
              checked={draft.optionIds === 'all'}
              onCheckedChange={(v) => (v ? onChange({ optionIds: 'all' }) : null)}
            />
            {d.allOptions}
          </label>
          {options.map((o) => (
            <label
              key={o.id}
              htmlFor={`rule-option-${o.id}`}
              className="flex cursor-pointer items-center gap-2 text-body"
            >
              <Checkbox
                id={`rule-option-${o.id}`}
                checked={draft.optionIds !== 'all' && draft.optionIds.includes(o.id)}
                onCheckedChange={(v) => handleOption(o.id, Boolean(v))}
              />
              {o.name}
            </label>
          ))}
        </div>
        {draft.custom ? null : (
          <div className="flex flex-col gap-2">
            <FieldLabel>{d.through}</FieldLabel>
            <RadioGroup
              value={draft.through}
              onValueChange={(v) => {
                const next = String(v)
                if (isThrough(next)) onChange({ through: next })
              }}
            >
              {through.map((t) => (
                <label
                  key={t}
                  htmlFor={`rule-through-${t}`}
                  className="flex cursor-pointer items-center gap-2 text-body"
                >
                  <RadioGroupItem id={`rule-through-${t}`} value={t} />
                  {d.throughItems[t]}
                </label>
              ))}
            </RadioGroup>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
