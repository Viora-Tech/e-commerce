'use client'

import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@commerce/ui/shadcn/input-group'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import DataCard from '@/components/layout/data-card'
import { loyaltyRewardContent } from '@/data/loyalty-reward'
import { useCopy } from '@/hooks/use-copy'
import { givesCode, type RewardForm } from '@/lib/loyalty-reward-form'

type RewardLimitsCardProps = {
  form: RewardForm
  /** How many times the saved reward was redeemed; null for a new one. */
  used: number | null
  onChange: (patch: Partial<RewardForm>) => void
}

/** Digits only, as typed (empty stays empty). */
const digits = (raw: string) => raw.replace(/[^\d]/g, '')

/** Where the limit and the code's life start when switched on. */
const LIMIT_START = '100'
const DAYS_START = '90'

/**
 * "Usage limit": a total cap (with how often it was used) and once per member; then
 * "Discount code": when the code expires (never, or after some days). Store credit has no code.
 */
export default function RewardLimitsCard({ form, used, onChange }: RewardLimitsCardProps) {
  // Hooks
  const copy = useCopy(loyaltyRewardContent)

  // Render logic
  const limited = form.usageLimit !== ''
  const expires = form.codeDays !== ''

  return (
    <>
      <DataCard title={copy.limits}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <Field orientation="horizontal">
                <Checkbox
                  id="reward-limit-on"
                  checked={limited}
                  onCheckedChange={(on) => onChange({ usageLimit: on ? LIMIT_START : '' })}
                />
                <FieldLabel htmlFor="reward-limit-on" className="font-normal">
                  {copy.usageLimit}
                </FieldLabel>
              </Field>
              {used !== null ? (
                <span className="shrink-0 text-caption text-muted-foreground">
                  {copy.used(used)}
                </span>
              ) : null}
            </div>
            {limited ? (
              <div className="pl-7">
                <Input
                  id="reward-usage"
                  size="lg"
                  inputMode="numeric"
                  aria-label={copy.usageLimit}
                  className="w-40"
                  value={form.usageLimit}
                  onChange={(e) => onChange({ usageLimit: digits(e.target.value) || '1' })}
                />
              </div>
            ) : null}
          </div>
          <Field orientation="horizontal">
            <Checkbox
              id="reward-once"
              checked={form.oncePerCustomer}
              onCheckedChange={(on) => onChange({ oncePerCustomer: Boolean(on) })}
            />
            <FieldLabel htmlFor="reward-once" className="font-normal">
              {copy.oncePerCustomer}
            </FieldLabel>
          </Field>
        </div>
      </DataCard>
      {givesCode(form.type) ? (
        <DataCard title={copy.code}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="reward-code-expires">{copy.codeExpires}</FieldLabel>
              <NativeSelect
                id="reward-code-expires"
                value={expires ? 'days' : 'never'}
                onChange={(e) =>
                  onChange({ codeDays: e.target.value === 'days' ? DAYS_START : '' })
                }
              >
                <NativeSelectOption value="never">{copy.never}</NativeSelectOption>
                <NativeSelectOption value="days">{copy.afterDays}</NativeSelectOption>
              </NativeSelect>
            </Field>
            {expires ? (
              <Field>
                <FieldLabel htmlFor="reward-code-days">{copy.codeDays}</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="reward-code-days"
                    inputMode="numeric"
                    value={form.codeDays}
                    onChange={(e) => onChange({ codeDays: digits(e.target.value) || '1' })}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>{copy.daysUnit}</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
            ) : null}
          </div>
        </DataCard>
      ) : null}
    </>
  )
}
