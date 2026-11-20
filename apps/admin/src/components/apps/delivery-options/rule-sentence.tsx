'use client'

import type { RuleTargetKind } from '@commerce/core/delivery-options'
import { X } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { FieldError } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { useCopy } from '@/hooks/use-copy'
import { CARRIERS, carrierName } from './format'
import { KINDS, picks, type RuleDraft, type RuleErrors } from './rule-draft'

type RuleSentenceProps = {
  draft: RuleDraft
  /** Shown only after a save was tried. */
  errors: RuleErrors | null
  onChange: (patch: Partial<RuleDraft>) => void
  onBrowse: () => void
}

const CHIP =
  'inline-flex h-8 items-center gap-1 rounded-full border border-hairline bg-card pr-1 pl-3 text-body text-ink-strong'

/**
 * The rule as one sentence (#1781, Figma 929:12840 style): "[Glasspads] ship only with
 * [Delhivery ×] [+ Add courier]". The products part is All products, picked products or
 * collections, or typed tags or types. A rule in the detailed editor shows only the products.
 */
export default function RuleSentence({ draft, errors, onChange, onBrowse }: RuleSentenceProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)

  // Event handlers
  const handleKind = (kind: string) =>
    onChange({ kind: kind as RuleTargetKind, values: [], titles: [], text: '' })
  const handleAdd = (carrier: string) => onChange({ carriers: [...draft.carriers, carrier] })
  const handleRemove = (carrier: string) =>
    onChange({ carriers: draft.carriers.filter((c) => c !== carrier) })

  // Render logic
  const d = copy.ruleDialog
  const s = d.sentence
  const addable = CARRIERS.filter((c) => !draft.carriers.includes(c.key))
  // Names when every pick's title is known (picked in this dialog), else the count.
  const named = draft.titles.length > 0 && draft.titles.length === draft.values.length
  const counted = copy.rules.targets[draft.kind === 'products' ? 'products' : 'collections']
  const pickedLabel = named
    ? draft.titles.join(', ')
    : draft.values.length
      ? counted(draft.values.length)
      : d.browse

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-body font-medium text-ink-strong">{s.label}</legend>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-panel-border bg-muted/40 p-3">
        <div className="w-40">
          <ChoiceField
            id="rule-kind"
            label={s.kind}
            hideLabel
            value={draft.kind}
            options={KINDS.map((k) => ({ value: k, label: d.targetKinds[k] }))}
            onChange={handleKind}
          />
        </div>
        {draft.kind === 'all' ? null : picks(draft.kind) ? (
          <Button
            variant="outline"
            className={cn('max-w-64', errors?.target && 'border-destructive')}
            onClick={onBrowse}
          >
            <span className="truncate">{pickedLabel}</span>
          </Button>
        ) : (
          <Input
            aria-label={s.valuesLabel}
            aria-invalid={errors?.target || undefined}
            className="w-56"
            value={draft.text}
            placeholder={s.valuesPlaceholder}
            onChange={(e) => onChange({ text: e.target.value })}
          />
        )}
        {draft.custom ? null : (
          <>
            <span className="text-body text-muted-foreground">{s.shipOnlyWith}</span>
            {draft.carriers.length === 0 ? (
              <span className="text-body text-muted-foreground italic">{s.noCourier}</span>
            ) : null}
            {draft.carriers.map((c) => {
              const name = carrierName(c, copy.routeDialog.anyCourier)
              return (
                <span key={c} className={CHIP}>
                  {name}
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="rounded-full"
                    aria-label={s.removeCourier(name)}
                    onClick={() => handleRemove(c)}
                  >
                    <X aria-hidden />
                  </Button>
                </span>
              )
            })}
            {addable.length ? (
              <div className="w-44">
                <ChoiceField
                  id="rule-add-courier"
                  label={s.addCourier}
                  hideLabel
                  placeholder={`+ ${s.addCourier}`}
                  value=""
                  options={addable.map((c) => ({ value: c.key, label: c.name }))}
                  onChange={handleAdd}
                />
              </div>
            ) : null}
          </>
        )}
      </div>
      {errors?.target ? <FieldError>{d.errors.target}</FieldError> : null}
      {errors?.couriers ? <FieldError>{d.errorsSimple.couriers}</FieldError> : null}
    </fieldset>
  )
}
