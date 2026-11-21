'use client'

import { Button } from '@commerce/ui/shadcn/button'
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '@commerce/ui/shadcn/combobox'
import { FieldError } from '@commerce/ui/shadcn/field'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { deliveryRuleFormContent } from '@/data/delivery-rule-form'
import { useCopy } from '@/hooks/use-copy'
import type { RuleChip } from './rule-presets'
import { chipLabel } from './rule-preview'

type RuleCourierChipsProps = {
  chips: RuleChip[]
  ticked: string[]
  /** The connected couriers are still being asked. */
  loading: boolean
  /** "Add at least one courier", after a save was tried. */
  error: boolean
  onChange: (ticked: string[]) => void
  onRetry: () => void
}

/**
 * Step 2 of the product rule dialog: the couriers shoppers can choose, as one searchable
 * multi-select (owner, 21 Nov 2026: a row of toggle chips gets unreadable when a store connects
 * many couriers). The picked ones show as removable tags; typing filters the list. A courier a
 * saved rule names that no app offers now still shows, marked "not connected".
 */
export default function RuleCourierChips({
  chips,
  ticked,
  loading,
  error,
  onChange,
  onRetry,
}: RuleCourierChipsProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)
  const form = useCopy(deliveryRuleFormContent)
  const anchor = useComboboxAnchor()

  // Render logic
  const c = form.chips
  const byId = new Map(chips.map((chip) => [chip.id, chip]))
  const nameOf = (id: string) => {
    const chip = byId.get(id)
    if (!chip) return id
    const name = chipLabel(chip, copy, form)
    return chip.missing ? `${name} · ${c.notConnected}` : name
  }
  const ids = chips.map((chip) => chip.id)

  return (
    <div className="flex flex-col gap-2">
      {chips.length === 0 ? (
        <p className="text-body text-muted-foreground">
          {loading ? c.loading : c.none}{' '}
          {loading ? null : (
            <Button variant="link" className="h-auto p-0" onClick={onRetry}>
              {c.retry}
            </Button>
          )}
        </p>
      ) : (
        <Combobox
          items={ids}
          multiple
          value={ticked.filter((id) => byId.has(id))}
          onValueChange={(next: string[]) => onChange(next)}
          itemToStringLabel={nameOf}
        >
          <ComboboxChips ref={anchor} aria-invalid={error || undefined}>
            <ComboboxValue>
              {(values: string[]) =>
                values.map((id) => (
                  <ComboboxChip key={id} aria-label={nameOf(id)}>
                    {nameOf(id)}
                  </ComboboxChip>
                ))
              }
            </ComboboxValue>
            <ComboboxChipsInput
              aria-label={c.search}
              placeholder={ticked.length === 0 ? c.search : c.add}
            />
          </ComboboxChips>
          <ComboboxContent anchor={anchor}>
            <ComboboxEmpty>{c.noMatch}</ComboboxEmpty>
            <ComboboxList>
              {(id: string) => (
                <ComboboxItem key={id} value={id}>
                  {nameOf(id)}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      )}
      {error ? <FieldError>{copy.ruleDialog.errorsSimple.couriers}</FieldError> : null}
    </div>
  )
}
