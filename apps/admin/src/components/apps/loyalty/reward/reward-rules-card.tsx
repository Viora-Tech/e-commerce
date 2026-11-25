'use client'

import type { TierRow } from '@commerce/core'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@commerce/ui/shadcn/input-group'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import MoneyInput from '@/components/fields/money-input'
import DataCard from '@/components/layout/data-card'
import { loyaltyRewardContent } from '@/data/loyalty-reward'
import { useCopy } from '@/hooks/use-copy'
import { givesCode, type RewardForm } from '@/lib/loyalty-reward-form'

type RewardRulesCardProps = {
  form: RewardForm
  tiers: TierRow[]
  onChange: (patch: Partial<RewardForm>) => void
}

/** Digits only, as typed (empty stays empty). */
const digits = (raw: string) => raw.replace(/[^\d]/g, '')

/** The minimum order a merchant starts from when they pick "Minimum purchase amount". */
const MIN_ORDER_START = '500'

/**
 * "Eligibility": who can redeem (tier) and for how many points on one row, the per-redeem range
 * for a member-picked amount; then "Requirements": no minimum or a minimum purchase amount.
 */
export default function RewardRulesCard({ form, tiers, onChange }: RewardRulesCardProps) {
  // Hooks
  const copy = useCopy(loyaltyRewardContent)

  // Render logic
  const custom = form.type === 'custom_amount_off'
  const hasMin = form.minOrder.trim() !== ''
  const lowest = tiers[0]?.name

  return (
    <>
      <DataCard title={copy.eligibility}>
        <div className="flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <Field>
              <FieldLabel htmlFor="reward-tier">{copy.tierLabel}</FieldLabel>
              <NativeSelect
                id="reward-tier"
                value={form.minTierId ?? ''}
                onChange={(e) => onChange({ minTierId: e.target.value || null })}
              >
                <NativeSelectOption value="">
                  {lowest ? copy.everyoneFrom(lowest) : copy.everyone}
                </NativeSelectOption>
                {tiers.map((t) => (
                  <NativeSelectOption key={t.id} value={t.id}>
                    {copy.minTier(t.name)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="reward-cost">{custom ? copy.costPerStep : copy.cost}</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="reward-cost"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={form.pointsCost}
                  onChange={(e) =>
                    onChange({ pointsCost: Math.max(0, Math.round(Number(e.target.value))) })
                  }
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>{copy.pointsUnit}</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
            </Field>
          </div>
          {custom ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="reward-min-points">{copy.minPoints}</FieldLabel>
                <InputGroupInputRow
                  id="reward-min-points"
                  value={form.minPoints}
                  unit={copy.pointsUnit}
                  onChange={(minPoints) => onChange({ minPoints })}
                />
                <FieldDescription>{copy.rangeHelp}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="reward-max-points">{copy.maxPoints}</FieldLabel>
                <InputGroupInputRow
                  id="reward-max-points"
                  value={form.maxPoints}
                  unit={copy.pointsUnit}
                  onChange={(maxPoints) => onChange({ maxPoints })}
                />
              </Field>
            </div>
          ) : null}
        </div>
      </DataCard>
      {givesCode(form.type) ? (
        <DataCard title={copy.requirements}>
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-body font-medium text-ink-strong">{copy.minOrder}</legend>
            <RadioGroup
              value={hasMin ? 'amount' : 'none'}
              onValueChange={(v) => onChange({ minOrder: v === 'amount' ? MIN_ORDER_START : '' })}
              className="flex flex-col gap-2"
            >
              <Field orientation="horizontal">
                <RadioGroupItem id="reward-min-none" value="none" />
                <FieldLabel htmlFor="reward-min-none" className="font-normal">
                  {copy.minNone}
                </FieldLabel>
              </Field>
              <Field orientation="horizontal">
                <RadioGroupItem id="reward-min-amount" value="amount" />
                <FieldLabel htmlFor="reward-min-amount" className="font-normal">
                  {copy.minAmount}
                </FieldLabel>
              </Field>
            </RadioGroup>
            {hasMin ? (
              <div className="pl-7">
                <MoneyInput
                  id="reward-min-order"
                  size="lg"
                  className="w-48"
                  value={form.minOrder}
                  onChange={(minOrder) => onChange({ minOrder: minOrder === '' ? '0' : minOrder })}
                />
              </div>
            ) : null}
          </fieldset>
        </DataCard>
      ) : null}
    </>
  )
}

type InputGroupInputRowProps = {
  id: string
  value: string
  unit: string
  onChange: (value: string) => void
}

/** A whole-number field with its unit after it (points). */
function InputGroupInputRow({ id, value, unit, onChange }: InputGroupInputRowProps) {
  return (
    <InputGroup className="w-48">
      <InputGroupInput
        id={id}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(digits(e.target.value))}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupText>{unit}</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  )
}
