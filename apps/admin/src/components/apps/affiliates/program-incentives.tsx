'use client'

import {
  COUPON_APPLIES_TO,
  type CouponAppliesTo,
  type CouponTarget,
  couponTargets,
  type ProgramRules,
} from '@commerce/plugin-affiliates/settings'
import { Switch } from '@commerce/ui/shadcn/switch'
import NumberField from '@/components/apps/affiliates/number-field'
import SetupCard from '@/components/apps/affiliates/setup-card'
import MoneyInput from '@/components/fields/money-input'
import SectionHead from '@/components/layout/section-head'
import type { PickItem } from '@/components/pickers/resource-pick-types'
import SettingsRow from '@/components/settings/settings-row'
import { affiliatesContent } from '@/data/affiliates'
import { affiliatesLayoutContent } from '@/data/affiliates-layout'
import { useCopy } from '@/hooks/use-copy'
import ChoiceSelect from './choice-select'
import TargetPicker from './target-picker'
import { idsOf, patchRow, percentToBp, withPicked } from './targets'

type ProgramIncentivesProps = {
  coupon: ProgramRules['coupon']
  onChange: (coupon: ProgramRules['coupon']) => void
}

/**
 * Program editor › Customer incentives: the affiliate's personal discount code and what buyers
 * save, on the whole order or on chosen products (each its own percent) or collections.
 */
export default function ProgramIncentives({ coupon, onChange }: ProgramIncentivesProps) {
  // Hooks
  const { editor: copy } = useCopy(affiliatesLayoutContent)
  const { settings } = useCopy(affiliatesContent)

  // Helpers
  const productBp = (id: string) => coupon.targets.find((t) => t.id === id)?.bp ?? coupon.bp
  const productRate = (item: PickItem) => (
    <MoneyInput
      value={String(productBp(item.id) / 100)}
      onChange={(typed) => handleProductRate(item.id, typed)}
      currency={false}
      suffix="%"
      aria-label={settings.rateFor(item.title)}
    />
  )

  // Event handlers
  const handleScope = (appliesTo: CouponAppliesTo) => onChange({ ...coupon, appliesTo })
  const handlePicked = (kind: CouponTarget['target'], ids: string[]) =>
    onChange({
      ...coupon,
      targets: withPicked(coupon.targets, kind, ids, (id) => ({
        target: kind,
        id,
        label: '',
        bp: coupon.bp,
      })),
    })
  const handleProductRate = (id: string, typed: string) =>
    onChange({
      ...coupon,
      targets: patchRow(coupon.targets, 'product', id, { bp: percentToBp(typed, 1) }),
    })

  // Render logic
  const scope = coupon.appliesTo
  const missing = scope !== 'all' && couponTargets(coupon).length === 0

  return (
    <section className="flex flex-col gap-4">
      <SectionHead title={copy.sections.incentives} />
      <SetupCard
        title={copy.autoDiscount}
        description={copy.autoDiscountHelp}
        active={coupon.enabled}
      >
        <SettingsRow
          label={settings.couponOn}
          description={settings.couponHelp}
          htmlFor="aff-coupon"
        >
          <Switch
            id="aff-coupon"
            checked={coupon.enabled}
            onCheckedChange={(enabled) => onChange({ ...coupon, enabled })}
          />
        </SettingsRow>
        {coupon.enabled ? (
          <SettingsRow
            label={settings.couponAppliesTo}
            description={settings.couponScopeHelp[scope]}
            htmlFor="aff-coupon-scope"
          >
            <ChoiceSelect
              id="aff-coupon-scope"
              value={scope}
              options={COUPON_APPLIES_TO.map((v) => ({
                value: v,
                label: settings.couponScopes[v],
              }))}
              onChange={handleScope}
            />
          </SettingsRow>
        ) : null}
        {coupon.enabled && scope !== 'products' ? (
          <NumberField
            id="aff-coupon-rate"
            label={scope === 'collections' ? settings.couponCollectionsRate : settings.couponRate}
            value={coupon.bp}
            scale={100}
            min={1}
            max={100}
            onChange={(bp) => onChange({ ...coupon, bp: Math.min(10_000, Math.max(1, bp)) })}
          />
        ) : null}
        {coupon.enabled && scope !== 'all' ? (
          <SettingsRow
            label={settings.couponScopes[scope]}
            error={missing ? settings.couponPickNeeded : undefined}
          >
            <TargetPicker
              kind={scope === 'products' ? 'product' : 'collection'}
              ids={idsOf(coupon.targets, scope === 'products' ? 'product' : 'collection')}
              onChange={(ids) => handlePicked(scope === 'products' ? 'product' : 'collection', ids)}
              rowExtra={scope === 'products' ? productRate : undefined}
            />
          </SettingsRow>
        ) : null}
      </SetupCard>
    </section>
  )
}
