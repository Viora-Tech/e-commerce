'use client'

import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { useCopy } from '@/hooks/use-copy'
import { carrierName } from './format'
import {
  preferredChoices,
  type RuleDraft,
  THROUGH,
  THROUGH_OFFERED,
  type Through,
} from './rule-draft'

type RuleRouteChoicesProps = {
  draft: RuleDraft
  /** "Tick at least one speed", after a save was tried. */
  speedsError: boolean
  onChange: (patch: Partial<RuleDraft>) => void
}

const NONE = 'none'

/**
 * Under the rule's sentence: through which account (own account, RapidShyp, Shiprocket or
 * either), which speeds, the preferred courier, and "always by it at the option's price"
 * (`forceRoute`, you pay the difference). Owner's redesign, 17 Nov (#1781, #1782).
 */
export default function RuleRouteChoices({ draft, speedsError, onChange }: RuleRouteChoicesProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)

  // Helpers
  const name = (carrier: string) => carrierName(carrier, copy.routeDialog.anyCourier)

  // Render logic
  const d = copy.ruleDialog
  const through = THROUGH_OFFERED.includes(draft.through)
    ? THROUGH_OFFERED
    : THROUGH.filter((t) => THROUGH_OFFERED.includes(t) || t === draft.through)
  const choices = preferredChoices(draft).map((c) => ({
    value: `${c.carrier}:${c.speed}`,
    label: `${name(c.carrier)} ${d.speeds[c.speed]}`,
  }))
  const [savedCarrier, savedSpeed] = draft.preferred?.split(':') ?? []
  const anySpeed =
    savedSpeed === 'any' && savedCarrier
      ? [{ value: `${savedCarrier}:any`, label: d.preferredAny(name(savedCarrier)) }]
      : []

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <FieldLabel>{d.through}</FieldLabel>
          <RadioGroup
            value={draft.through}
            onValueChange={(v) => onChange({ through: v as Through })}
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
        <div className="flex flex-col gap-2">
          <FieldLabel>{d.speedsLabel}</FieldLabel>
          {(['standard', 'express'] as const).map((s) => (
            <label
              key={s}
              htmlFor={`rule-speed-${s}`}
              className="flex cursor-pointer items-center gap-2 text-body"
            >
              <Checkbox
                id={`rule-speed-${s}`}
                checked={draft[s]}
                onCheckedChange={(v) =>
                  onChange(s === 'standard' ? { standard: Boolean(v) } : { express: Boolean(v) })
                }
              />
              {d.speeds[s]}
            </label>
          ))}
          {speedsError ? <FieldError>{d.errorsSimple.speeds}</FieldError> : null}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <ChoiceField
          id="rule-preferred"
          label={d.preferred}
          help={d.preferredHelp}
          value={draft.preferred ?? NONE}
          options={[{ value: NONE, label: d.noPreferred }, ...anySpeed, ...choices]}
          onChange={(v) =>
            onChange(v === NONE ? { preferred: null, forceRoute: false } : { preferred: v })
          }
        />
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
            {d.forceRoute}
            <FieldDescription>{d.forceRouteHelp}</FieldDescription>
          </span>
        </label>
      </div>
    </div>
  )
}
