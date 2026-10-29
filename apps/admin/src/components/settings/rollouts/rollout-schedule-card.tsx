'use client'

import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { RadioGroup } from '@commerce/ui/shadcn/radio-group'
import DataCard from '@/components/layout/data-card'
import { rolloutsContent } from '@/data/rollouts'
import { useCopy } from '@/hooks/use-copy'
import type { RolloutFormState } from './rollout-form-state'
import RolloutOption from './rollout-option'

type RolloutScheduleCardProps = {
  form: Pick<RolloutFormState, 'kind' | 'startsAt' | 'endsAt' | 'endAction'>
  endError: boolean
  /** The start is fixed once the rollout has started. */
  startDisabled: boolean
  /** The end and what happens at it are fixed once the rollout ended. */
  endDisabled: boolean
  onChange: (patch: Partial<RolloutFormState>) => void
}

/** When the rollout starts and, for an event, when it ends and what happens then. */
export default function RolloutScheduleCard({
  form,
  endError,
  startDisabled,
  endDisabled,
  onChange,
}: RolloutScheduleCardProps) {
  // Hooks
  const { schedule: copy } = useCopy(rolloutsContent).form

  // Render logic
  const isEvent = form.kind === 'event'

  return (
    <DataCard title={copy.heading}>
      <FieldGroup>
        <div className="grid gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="rollout-start">{copy.start}</FieldLabel>
            <Input
              size="lg"
              id="rollout-start"
              type="datetime-local"
              value={form.startsAt}
              disabled={startDisabled}
              onChange={(e) => onChange({ startsAt: e.target.value })}
            />
            <FieldDescription>{copy.startHelp}</FieldDescription>
          </Field>
          {isEvent ? (
            <Field data-invalid={endError ? true : undefined}>
              <FieldLabel htmlFor="rollout-end">{copy.end}</FieldLabel>
              <Input
                size="lg"
                id="rollout-end"
                type="datetime-local"
                value={form.endsAt}
                min={form.startsAt || undefined}
                disabled={endDisabled}
                aria-invalid={endError ? true : undefined}
                onChange={(e) => onChange({ endsAt: e.target.value })}
              />
              {endError ? <FieldError>{copy.endError}</FieldError> : null}
            </Field>
          ) : null}
        </div>
        {isEvent ? (
          <Field>
            <FieldLabel>{copy.atEnd}</FieldLabel>
            <RadioGroup
              value={form.endAction}
              disabled={endDisabled}
              onValueChange={(v) => onChange({ endAction: v === 'apply' ? 'apply' : 'rollback' })}
            >
              <RolloutOption
                id="rollout-end-rollback"
                value="rollback"
                label={copy.rollback}
                help={copy.rollbackHelp}
              />
              <RolloutOption
                id="rollout-end-apply"
                value="apply"
                label={copy.apply}
                help={copy.applyHelp}
              />
            </RadioGroup>
          </Field>
        ) : null}
        <FieldDescription>{copy.tz}</FieldDescription>
      </FieldGroup>
    </DataCard>
  )
}
