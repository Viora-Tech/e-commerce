'use client'

import type { TierRow } from '@commerce/core'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import MoneyInput from '@/components/fields/money-input'
import SwitchRow from '@/components/fields/switch-row'
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

/** Who can redeem and for how many points, the minimum order, usage limits and on/off. */
export default function RewardRulesCard({ form, tiers, onChange }: RewardRulesCardProps) {
  // Hooks
  const copy = useCopy(loyaltyRewardContent)

  // Render logic
  const custom = form.type === 'custom_amount_off'

  return (
    <>
      <DataCard title={copy.eligibility}>
        <div className="flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="reward-tier">{copy.tierLabel}</FieldLabel>
              <NativeSelect
                id="reward-tier"
                value={form.minTierId ?? ''}
                onChange={(e) => onChange({ minTierId: e.target.value || null })}
              >
                <NativeSelectOption value="">{copy.everyone}</NativeSelectOption>
                {tiers.map((t) => (
                  <NativeSelectOption key={t.id} value={t.id}>
                    {copy.minTier(t.name)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="reward-cost">{custom ? copy.costPerStep : copy.cost}</FieldLabel>
              <Input
                id="reward-cost"
                size="lg"
                type="number"
                inputMode="numeric"
                min={0}
                className="w-40"
                value={form.pointsCost}
                onChange={(e) =>
                  onChange({ pointsCost: Math.max(0, Math.round(Number(e.target.value))) })
                }
              />
            </Field>
          </div>
          {custom ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="reward-min-points">{copy.minPoints}</FieldLabel>
                <Input
                  id="reward-min-points"
                  size="lg"
                  inputMode="numeric"
                  className="w-40"
                  value={form.minPoints}
                  onChange={(e) => onChange({ minPoints: digits(e.target.value) })}
                />
                <FieldDescription>{copy.rangeHelp}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="reward-max-points">{copy.maxPoints}</FieldLabel>
                <Input
                  id="reward-max-points"
                  size="lg"
                  inputMode="numeric"
                  className="w-40"
                  value={form.maxPoints}
                  onChange={(e) => onChange({ maxPoints: digits(e.target.value) })}
                />
              </Field>
            </div>
          ) : null}
        </div>
      </DataCard>
      {givesCode(form.type) ? (
        <DataCard title={copy.requirements}>
          <Field>
            <FieldLabel htmlFor="reward-min-order">{copy.minOrder}</FieldLabel>
            <MoneyInput
              id="reward-min-order"
              size="lg"
              className="w-48"
              value={form.minOrder}
              onChange={(minOrder) => onChange({ minOrder })}
            />
            <FieldDescription>{copy.minOrderHelp}</FieldDescription>
          </Field>
        </DataCard>
      ) : null}
      <DataCard title={copy.limits}>
        <div className="flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="reward-usage">{copy.usageLimit}</FieldLabel>
              <Input
                id="reward-usage"
                size="lg"
                inputMode="numeric"
                className="w-40"
                value={form.usageLimit}
                onChange={(e) => onChange({ usageLimit: digits(e.target.value) })}
              />
              <FieldDescription>{copy.usageLimitHelp}</FieldDescription>
            </Field>
            {givesCode(form.type) ? (
              <Field>
                <FieldLabel htmlFor="reward-code-days">{copy.codeDays}</FieldLabel>
                <Input
                  id="reward-code-days"
                  size="lg"
                  inputMode="numeric"
                  className="w-40"
                  value={form.codeDays}
                  onChange={(e) => onChange({ codeDays: digits(e.target.value) })}
                />
                <FieldDescription>{copy.codeDaysHelp}</FieldDescription>
              </Field>
            ) : null}
          </div>
          <SwitchRow
            label={copy.oncePerCustomer}
            description={copy.oncePerCustomerHelp}
            checked={form.oncePerCustomer}
            onChange={(oncePerCustomer) => onChange({ oncePerCustomer })}
          />
          <SwitchRow
            label={copy.active}
            description={copy.activeHelp}
            checked={form.active}
            onChange={(active) => onChange({ active })}
          />
        </div>
      </DataCard>
    </>
  )
}
