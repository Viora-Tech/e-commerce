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

type RolloutDetailsCardProps = {
  form: Pick<RolloutFormState, 'name' | 'kind'>
  nameError: boolean
  /** The name stays editable while a rollout runs; the type only before it starts. */
  nameDisabled: boolean
  kindDisabled: boolean
  onChange: (patch: Partial<RolloutFormState>) => void
}

const KINDS = ['event', 'launch'] as const

/** The rollout's name and type: an event (runs between two times) or a launch (stays). */
export default function RolloutDetailsCard({
  form,
  nameError,
  nameDisabled,
  kindDisabled,
  onChange,
}: RolloutDetailsCardProps) {
  // Hooks
  const { kinds, form: copy } = useCopy(rolloutsContent)

  return (
    <DataCard title={copy.details.heading}>
      <FieldGroup>
        <Field data-invalid={nameError ? true : undefined} className="max-w-md">
          <FieldLabel htmlFor="rollout-name">{copy.details.name}</FieldLabel>
          <Input
            id="rollout-name"
            size="lg"
            value={form.name}
            maxLength={120}
            placeholder={copy.details.namePlaceholder}
            disabled={nameDisabled}
            onChange={(e) => onChange({ name: e.target.value })}
          />
          {nameError ? <FieldError>{copy.details.nameError}</FieldError> : null}
        </Field>
        <Field>
          <FieldLabel>{copy.details.kind}</FieldLabel>
          <RadioGroup
            value={form.kind}
            disabled={kindDisabled}
            onValueChange={(v) => onChange({ kind: v === 'launch' ? 'launch' : 'event' })}
          >
            {KINDS.map((k) => (
              <RolloutOption
                key={k}
                id={`rollout-kind-${k}`}
                value={k}
                label={kinds[k]}
                help={copy.details.kindHelp[k]}
              />
            ))}
          </RadioGroup>
          {kindDisabled ? <FieldDescription>{copy.changes.locked}</FieldDescription> : null}
        </Field>
      </FieldGroup>
    </DataCard>
  )
}
