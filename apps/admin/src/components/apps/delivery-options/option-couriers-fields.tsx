'use client'

import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import SwitchRow from '@/components/fields/switch-row'
import { deliveryOptionQuestionsContent } from '@/data/delivery-option-questions'
import { deliveryOptionSectionsContent } from '@/data/delivery-option-sections'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { useCopy } from '@/hooks/use-copy'
import { CARRIERS } from './format'
import InlineWarning from './inline-warning'
import { ONE_COURIER } from './option-answers'
import { ALL_COURIERS, type OptionForm as Form } from './option-form-state'
import OptionSection from './option-section'
import RouteSelectorRow from './route-selector-row'
import RupeeField from './rupee-field'

type OptionCouriersFieldsProps = {
  form: Form
  onChange: (next: Form) => void
}

/** The select's value for "no preferred courier" (a select item needs a non-empty value). */
const NO_PREFERENCE = 'none'

/** Two to eight cards, as the engine allows; or every courier. */
const MAX_CHOICES = [2, 3, 4, 5, 6, 7, 8] as const

/**
 * "Which couriers show" in an option page's "More settings" (owner, 21 Nov 2026): the pick
 * first, then whether shoppers may pick the courier (with how many and which to hide), courier
 * names, and last the fine-tuning (preferred courier, prefer direct, allowed routes). Speed is
 * with the name; "one courier only" is question 2.
 */
export default function OptionCouriersFields({ form, onChange }: OptionCouriersFieldsProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)
  const sections = useCopy(deliveryOptionSectionsContent)
  const q = useCopy(deliveryOptionQuestionsContent)

  // Helpers
  const set =
    <K extends keyof Form>(key: K) =>
    (value: Form[K]) =>
      onChange({ ...form, [key]: value })

  // Event handlers
  const handleAddRoute = () =>
    set('selectors')([...form.selectors, { carrier: 'delhivery', channel: 'any', speed: 'any' }])

  // Render logic
  const r = copy.option.routing
  const k = copy.option.couriers
  const s = sections.sections.couriers

  return (
    <OptionSection title={s.title} help={s.help}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ChoiceField
          id="opt-strategy"
          label={r.strategy}
          help={r.strategyHelp}
          value={form.strategy}
          options={(['cheapest', 'fastest'] as const).map((v) => ({
            value: v,
            label: r.strategies[v],
          }))}
          onChange={(v) => set('strategy')(v === 'fastest' ? 'fastest' : 'cheapest')}
        />
      </div>
      <div className="flex flex-col">
        <SwitchRow
          id="opt-couriers-list"
          label={k.list}
          description={k.listHelp}
          checked={form.couriersList}
          onChange={set('couriersList')}
          weight="semibold"
          divided
        />
        <SwitchRow
          id="opt-show-names"
          label={k.showNames}
          description={k.showNamesHelp}
          checked={form.showNames}
          onChange={set('showNames')}
          weight="semibold"
          divided
        />
      </div>
      {form.couriersList && form.couriersMax !== String(ONE_COURIER) ? (
        <div className="flex flex-col gap-3 rounded-lg border border-hairline p-3">
          <ChoiceField
            id="opt-couriers-max"
            label={k.max}
            value={form.couriersMax}
            options={[
              { value: ALL_COURIERS, label: k.maxAll },
              ...MAX_CHOICES.map((n) => ({ value: String(n), label: k.maxItems(n) })),
            ]}
            onChange={set('couriersMax')}
          />
          <SwitchRow
            id="opt-hide-slower"
            label={k.hideSlower}
            description={k.hideSlowerHelp}
            checked={form.hideSlowerDearer}
            onChange={set('hideSlowerDearer')}
            weight="semibold"
            divided
          />
          <SwitchRow
            id="opt-same-price"
            label={q.more.sameAsFirst}
            description={q.more.sameAsFirstHelp}
            checked={form.couriersExtra === 'none'}
            onChange={(on) => set('couriersExtra')(on ? 'none' : 'difference')}
            weight="semibold"
            divided
          />
          {form.strategy === 'fastest' && form.hideSlowerDearer ? (
            <InlineWarning>{k.hideSlowerFastest}</InlineWarning>
          ) : null}
          {/* The old "+₹…9" switch counts only on the ₹10 rounding with the difference. */}
          {form.rounding === 'ten' && form.couriersExtra === 'difference' ? (
            <SwitchRow
              id="opt-round-9"
              label={k.roundTo9}
              description={k.roundTo9Help}
              checked={form.roundTo9}
              onChange={set('roundTo9')}
              weight="semibold"
              divided
            />
          ) : null}
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-3 border-t border-hairline pt-4 sm:grid-cols-2">
        <ChoiceField
          id="opt-prefer-carrier"
          label={r.preferCarrier}
          help={r.preferCarrierHelp}
          value={form.preferCarrier || NO_PREFERENCE}
          options={[
            { value: NO_PREFERENCE, label: r.noPreference },
            ...CARRIERS.map((c) => ({ value: c.key, label: c.name })),
          ]}
          onChange={(v) => set('preferCarrier')(v === NO_PREFERENCE ? '' : v)}
        />
        <RupeeField
          id="opt-prefer-direct"
          label={r.preferDirect}
          help={r.preferDirectHelp}
          value={form.preferDirect}
          onChange={set('preferDirect')}
        />
      </div>
      <ChoiceField
        id="opt-route-mode"
        label={r.routes}
        value={form.routeMode}
        options={(['any', 'allow', 'exclude'] as const).map((v) => ({
          value: v,
          label: r.routeModes[v],
        }))}
        onChange={(v) => set('routeMode')(v as Form['routeMode'])}
      />
      {form.routeMode === 'any' ? null : (
        <div className="flex flex-col gap-2">
          {form.selectors.map((sel, i) => (
            <RouteSelectorRow
              // biome-ignore lint/suspicious/noArrayIndexKey: rows have no identity of their own.
              key={i}
              id={`opt-route-${i}`}
              value={sel}
              onChange={(next) =>
                set('selectors')(form.selectors.map((x, j) => (j === i ? next : x)))
              }
              onRemove={() => set('selectors')(form.selectors.filter((_, j) => j !== i))}
            />
          ))}
          <Button variant="ghost" size="sm" className="w-fit" onClick={handleAddRoute}>
            <Plus aria-hidden />
            {copy.ruleDialog.addRoute}
          </Button>
        </div>
      )}
    </OptionSection>
  )
}
