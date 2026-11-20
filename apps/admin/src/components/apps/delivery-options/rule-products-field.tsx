'use client'

import type { RuleTargetKind } from '@commerce/core/delivery-options'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { FieldError } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { useCopy } from '@/hooks/use-copy'
import { KINDS, picks, type RuleDraft } from './rule-draft'

type RuleProductsFieldProps = {
  draft: RuleDraft
  /** "Pick at least one", after a save was tried. */
  error: boolean
  onChange: (patch: Partial<RuleDraft>) => void
  onBrowse: () => void
}

/**
 * Step 1 of the product rule dialog, "Which products?": All products, picked products or
 * collections, or typed tags or product types.
 */
export default function RuleProductsField({
  draft,
  error,
  onChange,
  onBrowse,
}: RuleProductsFieldProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)

  // Event handlers
  const handleKind = (kind: string) =>
    onChange({ kind: kind as RuleTargetKind, values: [], titles: [], text: '' })

  // Render logic
  const d = copy.ruleDialog
  const s = d.sentence
  // Names when every pick's title is known (picked in this dialog), else the count.
  const named = draft.titles.length > 0 && draft.titles.length === draft.values.length
  const counted = copy.rules.targets[draft.kind === 'products' ? 'products' : 'collections']
  const pickedLabel = named
    ? draft.titles.join(', ')
    : draft.values.length
      ? counted(draft.values.length)
      : d.browse

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
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
            className={cn('max-w-64', error && 'border-destructive')}
            onClick={onBrowse}
          >
            <span className="truncate">{pickedLabel}</span>
          </Button>
        ) : (
          <Input
            aria-label={s.valuesLabel}
            aria-invalid={error || undefined}
            className="w-56"
            value={draft.text}
            placeholder={s.valuesPlaceholder}
            onChange={(e) => onChange({ text: e.target.value })}
          />
        )}
      </div>
      {error ? <FieldError>{d.errors.target}</FieldError> : null}
    </div>
  )
}
