'use client'

import type { PreorderOverview } from '@commerce/core'
import {
  CAMPAIGN_CHANNELS,
  CAMPAIGN_DISCOUNT_TYPES,
  MIXED_CART_RULES,
  SOLD_OUT_IN_CART_RULES,
} from '@commerce/core/preorder'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { RadioGroup } from '@commerce/ui/shadcn/radio-group'
import MoneyInput from '@/components/fields/money-input'
import DataCard from '@/components/layout/data-card'
import StatusChip from '@/components/layout/status-chip'
import RolloutOption from '@/components/rollouts/rollout-option'
import { preordersContent } from '@/data/preorders'
import { useCopy } from '@/hooks/use-copy'
import type { CampaignFormState } from './campaign-form-state'

type CampaignRulesCardProps = {
  form: CampaignFormState
  markets: PreorderOverview['markets']
  locations: PreorderOverview['locations']
  disabled: boolean
  onChange: (patch: Partial<CampaignFormState>) => void
}

/** `list` with `id` ticked on or off. */
const toggled = <T extends string>(list: readonly T[], id: T, on: boolean): T[] =>
  on ? [...list.filter((x) => x !== id), id] : list.filter((x) => x !== id)

/** One of `values`, or `fallback` for anything else. */
const oneOf = <T extends string>(values: readonly T[], value: unknown, fallback: T): T =>
  values.find((v) => v === value) ?? fallback

/**
 * The campaign's rules (#143): its pre-order discount, the markets, stock locations and
 * channels it applies to, and what a cart may do. The cart and checkout enforce each one.
 */
export default function CampaignRulesCard({
  form,
  markets,
  locations,
  disabled,
  onChange,
}: CampaignRulesCardProps) {
  // Hooks
  const { rules: copy } = useCopy(preordersContent)

  return (
    <DataCard title={copy.heading}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="campaign-discount-type">{copy.discount}</FieldLabel>
          <div className="flex flex-wrap items-center gap-3">
            <NativeSelect
              id="campaign-discount-type"
              value={form.discountType}
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  discountType: oneOf(CAMPAIGN_DISCOUNT_TYPES, e.target.value, 'none'),
                  discountValue: '',
                })
              }
            >
              {CAMPAIGN_DISCOUNT_TYPES.map((t) => (
                <NativeSelectOption key={t} value={t}>
                  {copy.discountTypes[t]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {form.discountType === 'percentage' ? (
              <Input
                type="number"
                min={1}
                max={90}
                aria-label={copy.discountPercent}
                value={form.discountValue}
                disabled={disabled}
                onChange={(e) => onChange({ discountValue: e.target.value })}
                className="w-24"
              />
            ) : null}
            {form.discountType === 'fixed' ? (
              <MoneyInput
                aria-label={copy.discountAmount}
                value={form.discountValue}
                disabled={disabled}
                onChange={(discountValue) => onChange({ discountValue })}
                className="w-32"
              />
            ) : null}
          </div>
          <FieldDescription>{copy.discountHelp}</FieldDescription>
        </Field>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-body font-medium">{copy.markets}</legend>
          <p className="text-caption text-muted-foreground">{copy.marketsHelp}</p>
          {markets.length === 0 ? (
            <p className="text-caption text-muted-foreground">{copy.noMarkets}</p>
          ) : (
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {markets.map((m) => (
                <label
                  key={m.id}
                  htmlFor={`campaign-market-${m.id}`}
                  className="flex items-center gap-2 text-body"
                >
                  <Checkbox
                    id={`campaign-market-${m.id}`}
                    checked={form.marketIds.includes(m.id)}
                    disabled={disabled}
                    onCheckedChange={(on) =>
                      onChange({ marketIds: toggled(form.marketIds, m.id, on === true) })
                    }
                  />
                  {m.name}
                  {m.isPrimary ? <StatusChip>{copy.primary}</StatusChip> : null}
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-body font-medium">{copy.locations}</legend>
          <p className="text-caption text-muted-foreground">{copy.locationsHelp}</p>
          {locations.length === 0 ? (
            <p className="text-caption text-muted-foreground">{copy.noLocations}</p>
          ) : (
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {locations.map((l) => (
                <label
                  key={l.id}
                  htmlFor={`campaign-location-${l.id}`}
                  className="flex items-center gap-2 text-body"
                >
                  <Checkbox
                    id={`campaign-location-${l.id}`}
                    checked={form.locationIds.includes(l.id)}
                    disabled={disabled}
                    onCheckedChange={(on) =>
                      onChange({ locationIds: toggled(form.locationIds, l.id, on === true) })
                    }
                  />
                  {l.name}
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-body font-medium">{copy.channels}</legend>
          <p className="text-caption text-muted-foreground">{copy.channelsHelp}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {CAMPAIGN_CHANNELS.map((c) => (
              <label
                key={c}
                htmlFor={`campaign-channel-${c}`}
                className="flex items-center gap-2 text-body"
              >
                <Checkbox
                  id={`campaign-channel-${c}`}
                  checked={form.channels.includes(c)}
                  disabled={disabled}
                  onCheckedChange={(on) =>
                    onChange({ channels: toggled(form.channels, c, on === true) })
                  }
                />
                {copy.channelNames[c]}
              </label>
            ))}
          </div>
        </fieldset>

        <Field>
          <FieldLabel>{copy.mixedCart}</FieldLabel>
          <RadioGroup
            value={form.mixedCart}
            disabled={disabled}
            onValueChange={(v) => onChange({ mixedCart: oneOf(MIXED_CART_RULES, v, 'split') })}
          >
            {MIXED_CART_RULES.map((r) => (
              <RolloutOption
                key={r}
                id={`campaign-mixed-${r}`}
                value={r}
                label={copy.mixedCartOptions[r]}
                help={copy.mixedCartHelp[r]}
              />
            ))}
          </RadioGroup>
        </Field>

        <Field>
          <FieldLabel>{copy.soldOut}</FieldLabel>
          <RadioGroup
            value={form.soldOutInCart}
            disabled={disabled}
            onValueChange={(v) =>
              onChange({ soldOutInCart: oneOf(SOLD_OUT_IN_CART_RULES, v, 'preorder') })
            }
          >
            {SOLD_OUT_IN_CART_RULES.map((r) => (
              <RolloutOption
                key={r}
                id={`campaign-sold-out-${r}`}
                value={r}
                label={copy.soldOutOptions[r]}
                help={copy.soldOutHelp[r]}
              />
            ))}
          </RadioGroup>
        </Field>
      </FieldGroup>
    </DataCard>
  )
}
