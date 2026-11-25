'use client'

import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@commerce/ui/shadcn/input-group'
import { useState } from 'react'
import { loyaltyProgramContent } from '@/data/loyalty-program'
import { useCopy } from '@/hooks/use-copy'
import { multiplierText, parseMultiplier, type TierDraft } from '@/lib/loyalty-program'

type MultiplierFieldProps = {
  tier: TierDraft
  onChange: (patch: Partial<TierDraft>) => void
}

/** A tier's earning multiplier, typed as "1.5" (kept as text until it is a valid number). */
export default function MultiplierField({ tier, onChange }: MultiplierFieldProps) {
  // Hooks
  const copy = useCopy(loyaltyProgramContent)
  const [text, setText] = useState(multiplierText(tier.multiplierBp))

  // Event handlers
  const handleChange = (raw: string) => {
    setText(raw)
    const bp = parseMultiplier(raw)
    if (bp !== null) onChange({ multiplierBp: bp })
  }

  // Render logic
  const c = copy.tiers
  const bad = parseMultiplier(text) === null
  const id = `tier-${tier.key}-multiplier`

  return (
    <Field data-invalid={bad || undefined}>
      <FieldLabel htmlFor={id}>{c.multiplier}</FieldLabel>
      <InputGroup className="w-40">
        <InputGroupInput
          id={id}
          inputMode="decimal"
          value={text}
          aria-invalid={bad || undefined}
          onChange={(e) => handleChange(e.target.value)}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupText>x</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
      {bad ? (
        <FieldError>{c.multiplierInvalid}</FieldError>
      ) : (
        <FieldDescription>{c.multiplierHelp}</FieldDescription>
      )}
    </Field>
  )
}
