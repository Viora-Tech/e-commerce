'use client'

import type { ProgramRules } from '@commerce/plugin-affiliates/settings'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { Switch } from '@commerce/ui/shadcn/switch'
import NumberField from '@/components/apps/affiliates/number-field'
import SettingsCard from '@/components/settings/settings-card'
import SettingsRow from '@/components/settings/settings-row'
import { affiliatesContent } from '@/data/affiliates'
import { useCopy } from '@/hooks/use-copy'

type CommissionSettingsProps = {
  form: ProgramRules
  onChange: (patch: Partial<ProgramRules>) => void
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A program's rate, which orders earn, per-product rates, tiers and discount codes. */
export default function CommissionSettings({ form, onChange }: CommissionSettingsProps) {
  // Hooks
  const { settings: copy } = useCopy(affiliatesContent)

  // Event handlers
  const handleType = (type: string) =>
    onChange({
      commission: type === 'flat' ? { type: 'flat', paise: 100_00 } : { type: 'percent', bp: 1000 },
    })
  const handleAddOverride = () =>
    onChange({
      overrides: [
        ...form.overrides,
        { target: 'product', id: '', label: '', rule: { type: 'percent', bp: 1000 } },
      ],
    })
  const handleOverride = (i: number, patch: Partial<ProgramRules['overrides'][number]>) =>
    onChange({ overrides: form.overrides.map((o, j) => (j === i ? { ...o, ...patch } : o)) })
  const handleAddTier = () =>
    onChange({ tiers: [...form.tiers, { name: '', minSalesPaise: 50_000_00, bp: 1500 }] })
  const handleTier = (i: number, patch: Partial<ProgramRules['tiers'][number]>) =>
    onChange({ tiers: form.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) })

  // Render logic
  const c = form.commission

  return (
    <>
      <SettingsCard title={copy.commission} description={copy.commissionHelp}>
        <SettingsRow label={copy.type} htmlFor="aff-type">
          <NativeSelect id="aff-type" value={c.type} onChange={(e) => handleType(e.target.value)}>
            <NativeSelectOption value="percent">{copy.percent}</NativeSelectOption>
            <NativeSelectOption value="flat">{copy.flat}</NativeSelectOption>
          </NativeSelect>
        </SettingsRow>
        {c.type === 'percent' ? (
          <NumberField
            id="aff-rate"
            label={copy.rate}
            value={c.bp}
            scale={100}
            max={100}
            onChange={(bp) =>
              onChange({ commission: { type: 'percent', bp: Math.min(bp, 10_000) } })
            }
          />
        ) : (
          <NumberField
            id="aff-amount"
            label={copy.amount}
            value={c.paise}
            scale={100}
            onChange={(paise) => onChange({ commission: { type: 'flat', paise } })}
          />
        )}
        <SettingsRow label={copy.scope} htmlFor="aff-scope">
          <NativeSelect
            id="aff-scope"
            value={form.scope}
            onChange={(e) =>
              onChange({ scope: e.target.value === 'lifetime' ? 'lifetime' : 'first_order' })
            }
          >
            <NativeSelectOption value="first_order">{copy.scopeFirst}</NativeSelectOption>
            <NativeSelectOption value="lifetime">{copy.scopeLifetime}</NativeSelectOption>
          </NativeSelect>
        </SettingsRow>
        {form.scope === 'lifetime' ? (
          <NumberField
            id="aff-lifetime"
            label={copy.lifetimeDays}
            value={form.lifetimeDays}
            min={1}
            max={3650}
            onChange={(lifetimeDays) => onChange({ lifetimeDays: Math.max(1, lifetimeDays) })}
          />
        ) : null}
      </SettingsCard>
      <SettingsCard title={copy.overrides} description={copy.overridesHelp}>
        {form.overrides.length === 0 ? (
          <p className="text-caption text-muted-foreground">{copy.overrideNone}</p>
        ) : null}
        {form.overrides.map((o, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: rows have no id until saved
            key={`${i}-${o.target}`}
            className="grid gap-2 md:grid-cols-[8rem_1fr_1fr_6rem_auto]"
          >
            <NativeSelect
              value={o.target}
              aria-label={copy.type}
              onChange={(e) =>
                handleOverride(i, {
                  target: e.target.value === 'collection' ? 'collection' : 'product',
                })
              }
            >
              <NativeSelectOption value="product">{copy.overrideTarget.product}</NativeSelectOption>
              <NativeSelectOption value="collection">
                {copy.overrideTarget.collection}
              </NativeSelectOption>
            </NativeSelect>
            <Input
              placeholder={copy.overrideId}
              value={o.id}
              aria-invalid={o.id && !UUID.test(o.id) ? true : undefined}
              onChange={(e) => handleOverride(i, { id: e.target.value.trim() })}
            />
            <Input
              placeholder={copy.overrideLabel}
              value={o.label}
              onChange={(e) => handleOverride(i, { label: e.target.value })}
            />
            <Input
              type="number"
              min={0}
              max={100}
              step={0.01}
              aria-label={copy.rate}
              value={o.rule.type === 'percent' ? o.rule.bp / 100 : 0}
              onChange={(e) =>
                handleOverride(i, {
                  rule: { type: 'percent', bp: Math.round((Number(e.target.value) || 0) * 100) },
                })
              }
            />
            <Button
              variant="ghost"
              onClick={() => onChange({ overrides: form.overrides.filter((_, j) => j !== i) })}
            >
              {copy.remove}
            </Button>
          </div>
        ))}
        <div>
          <Button variant="outline" onClick={handleAddOverride}>
            {copy.addOverride}
          </Button>
        </div>
      </SettingsCard>
      <SettingsCard title={copy.tiers} description={copy.tiersHelp}>
        {form.tiers.map((t, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: rows have no id until saved; position is the identity
          <div key={`tier-${i}`} className="grid gap-2 md:grid-cols-[1fr_10rem_6rem_auto]">
            <Input
              placeholder={copy.tierName}
              value={t.name}
              onChange={(e) => handleTier(i, { name: e.target.value })}
            />
            <Input
              type="number"
              min={0}
              aria-label={copy.tierFrom}
              value={t.minSalesPaise / 100}
              onChange={(e) =>
                handleTier(i, { minSalesPaise: Math.round((Number(e.target.value) || 0) * 100) })
              }
            />
            <Input
              type="number"
              min={0}
              max={100}
              step={0.01}
              aria-label={copy.tierRate}
              value={t.bp / 100}
              onChange={(e) =>
                handleTier(i, { bp: Math.round((Number(e.target.value) || 0) * 100) })
              }
            />
            <Button
              variant="ghost"
              onClick={() => onChange({ tiers: form.tiers.filter((_, j) => j !== i) })}
            >
              {copy.remove}
            </Button>
          </div>
        ))}
        <div>
          <Button variant="outline" onClick={handleAddTier}>
            {copy.addTier}
          </Button>
        </div>
      </SettingsCard>
      <SettingsCard title={copy.coupon} description={copy.couponHelp}>
        <SettingsRow label={copy.couponOn} htmlFor="aff-coupon">
          <Switch
            id="aff-coupon"
            checked={form.coupon.enabled}
            onCheckedChange={(enabled) => onChange({ coupon: { ...form.coupon, enabled } })}
          />
        </SettingsRow>
        {form.coupon.enabled ? (
          <NumberField
            id="aff-coupon-rate"
            label={copy.couponRate}
            value={form.coupon.bp}
            scale={100}
            min={1}
            max={100}
            onChange={(bp) =>
              onChange({ coupon: { ...form.coupon, bp: Math.min(10_000, Math.max(1, bp)) } })
            }
          />
        ) : null}
      </SettingsCard>
    </>
  )
}
