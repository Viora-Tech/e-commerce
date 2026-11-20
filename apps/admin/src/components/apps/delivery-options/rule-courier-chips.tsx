'use client'

import { CheckIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
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

const CHIP =
  'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/**
 * Step 2 of the product rule dialog: one toggle chip per courier and speed the store has
 * connected ("Delhivery Air", "Blue Dart Surface"), which replaces the courier list and the
 * Speeds boxes. A chip a saved rule names that no app offers now still shows, marked.
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

  // Event handlers
  const handleToggle = (id: string) =>
    onChange(ticked.includes(id) ? ticked.filter((t) => t !== id) : [...ticked, id])

  // Render logic
  const c = form.chips

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
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => {
            const on = ticked.includes(chip.id)
            const name = chipLabel(chip, copy, form)
            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={on}
                aria-label={c.toggle(name)}
                onClick={() => handleToggle(chip.id)}
                className={cn(
                  CHIP,
                  on
                    ? 'border-primary bg-primary/10 text-ink-strong'
                    : 'border-hairline bg-card text-muted-foreground hover:text-ink-strong',
                )}
              >
                {on ? <CheckIcon aria-hidden className="size-3.5" /> : null}
                {name}
                {chip.missing ? (
                  <span className="text-caption text-muted-foreground">· {c.notConnected}</span>
                ) : null}
              </button>
            )
          })}
        </div>
      )}
      {error ? <FieldError>{copy.ruleDialog.errorsSimple.couriers}</FieldError> : null}
    </div>
  )
}
