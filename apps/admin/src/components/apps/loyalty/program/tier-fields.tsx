'use client'

import type { RewardRow } from '@commerce/core'
import type { LoyaltySettings } from '@commerce/core/loyalty'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@commerce/ui/shadcn/input-group'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { useState } from 'react'
import ColourInput from '@/components/metaobjects/colour-input'
import { loyaltyProgramContent } from '@/data/loyalty-program'
import { useCopy } from '@/hooks/use-copy'
import {
  multiplierText,
  parseMultiplier,
  type TierDraft,
  thresholdFieldValue,
  thresholdFromField,
} from '@/lib/loyalty-program'

type TierFieldsProps = {
  tier: TierDraft
  settings: LoyaltySettings
  rewards: RewardRow[]
  onChange: (patch: Partial<TierDraft>) => void
  onRemove: () => void
}

/** One tier's fields: name, what reaches it, multiplier, tag, reward on reaching it, colours. */
export default function TierFields({
  tier,
  settings,
  rewards,
  onChange,
  onRemove,
}: TierFieldsProps) {
  // Hooks
  const copy = useCopy(loyaltyProgramContent)
  const [multiplier, setMultiplier] = useState(multiplierText(tier.multiplierBp))

  // Event handlers
  const handleMultiplier = (raw: string) => {
    setMultiplier(raw)
    const bp = parseMultiplier(raw)
    if (bp !== null) onChange({ multiplierBp: bp })
  }

  // Render logic
  const c = copy.tiers
  const basis = settings.tierBasis
  const id = `tier-${tier.key}`
  const multiplierBad = parseMultiplier(multiplier) === null

  return (
    <div className="flex flex-col gap-5">
      <Field>
        <FieldLabel htmlFor={`${id}-name`}>{c.name}</FieldLabel>
        <Input
          id={`${id}-name`}
          size="lg"
          maxLength={60}
          value={tier.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`${id}-threshold`}>{c.threshold[basis]}</FieldLabel>
          <Input
            id={`${id}-threshold`}
            size="lg"
            type="number"
            inputMode="numeric"
            min={0}
            value={thresholdFieldValue(tier.threshold, basis)}
            onChange={(e) =>
              onChange({ threshold: thresholdFromField(Number(e.target.value), basis) })
            }
          />
          <FieldDescription>{c.thresholdHelp[settings.tierWindow]}</FieldDescription>
        </Field>
        <Field data-invalid={multiplierBad || undefined}>
          <FieldLabel htmlFor={`${id}-multiplier`}>{c.multiplier}</FieldLabel>
          <InputGroup className="w-40">
            <InputGroupInput
              id={`${id}-multiplier`}
              inputMode="decimal"
              value={multiplier}
              aria-invalid={multiplierBad || undefined}
              onChange={(e) => handleMultiplier(e.target.value)}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>x</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
          {multiplierBad ? (
            <FieldError>{c.multiplierInvalid}</FieldError>
          ) : (
            <FieldDescription>{c.multiplierHelp}</FieldDescription>
          )}
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`${id}-tag`}>{c.tag}</FieldLabel>
          <Input
            id={`${id}-tag`}
            size="lg"
            maxLength={60}
            value={tier.customerTag}
            onChange={(e) => onChange({ customerTag: e.target.value })}
          />
          <FieldDescription>{c.tagHelp}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-reward`}>{c.reward}</FieldLabel>
          <NativeSelect
            id={`${id}-reward`}
            value={tier.rewardId ?? ''}
            onChange={(e) => onChange({ rewardId: e.target.value || null })}
          >
            <NativeSelectOption value="">{c.rewardNone}</NativeSelectOption>
            {rewards.map((r) => (
              <NativeSelectOption key={r.id} value={r.id}>
                {r.title}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldDescription>{c.rewardHelp}</FieldDescription>
        </Field>
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-body font-medium text-ink-strong">{c.colors}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`${id}-bg`}>{c.background}</FieldLabel>
            <ColourInput
              id={`${id}-bg`}
              value={tier.colors.background}
              onChange={(background) =>
                background && onChange({ colors: { ...tier.colors, background } })
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-text`}>{c.text}</FieldLabel>
            <ColourInput
              id={`${id}-text`}
              value={tier.colors.text}
              onChange={(text) => text && onChange({ colors: { ...tier.colors, text } })}
            />
          </Field>
        </div>
      </fieldset>
      <div>
        <Button variant="outline" className="text-destructive" onClick={onRemove}>
          {c.remove}
        </Button>
      </div>
    </div>
  )
}
