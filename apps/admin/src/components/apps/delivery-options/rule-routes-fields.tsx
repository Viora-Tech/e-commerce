'use client'

import type { RouteSelector } from '@commerce/core/delivery-options'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { useCopy } from '@/hooks/use-copy'
import { selectorLabel } from './format'
import RouteSelectorRow from './route-selector-row'

type RuleRoutesFieldsProps = {
  routes: RouteSelector[]
  /** Index into `routes`; null: no default. */
  defaultIndex: number | null
  /** Indexes into `routes` the shopper may switch to. */
  alternatives: number[]
  error: string | null
  onChange: (next: {
    routes: RouteSelector[]
    defaultIndex: number | null
    alternatives: number[]
  }) => void
}

const NONE = 'none'

/** A rule's allowed routes, which one is the default and which the shopper may switch to. */
export default function RuleRoutesFields({
  routes,
  defaultIndex,
  alternatives,
  error,
  onChange,
}: RuleRoutesFieldsProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)

  // Event handlers
  const handleRoute = (i: number, next: RouteSelector) =>
    onChange({ routes: routes.map((r, j) => (j === i ? next : r)), defaultIndex, alternatives })
  const handleAdd = () =>
    onChange({
      routes: [...routes, { carrier: 'delhivery', channel: 'any', speed: 'any' }],
      defaultIndex,
      alternatives,
    })
  const handleRemove = (i: number) => {
    const shift = (j: number) => (j > i ? j - 1 : j)
    onChange({
      routes: routes.filter((_, j) => j !== i),
      defaultIndex: defaultIndex === i ? null : defaultIndex === null ? null : shift(defaultIndex),
      alternatives: alternatives.filter((j) => j !== i).map(shift),
    })
  }
  const handleDefault = (v: string) => {
    const index = v === NONE ? null : Number(v)
    onChange({ routes, defaultIndex: index, alternatives: alternatives.filter((j) => j !== index) })
  }
  const handleAlternative = (i: number, on: boolean) =>
    onChange({
      routes,
      defaultIndex,
      alternatives: on ? [...alternatives, i].sort() : alternatives.filter((j) => j !== i),
    })

  // Render logic
  const d = copy.ruleDialog

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <FieldLabel>{d.routes}</FieldLabel>
        {routes.map((r, i) => (
          <RouteSelectorRow
            // biome-ignore lint/suspicious/noArrayIndexKey: rows have no identity of their own.
            key={i}
            id={`rule-route-${i}`}
            value={r}
            onChange={(next) => handleRoute(i, next)}
            onRemove={routes.length > 1 ? () => handleRemove(i) : undefined}
          />
        ))}
        <Button variant="ghost" size="sm" className="w-fit" onClick={handleAdd}>
          <Plus aria-hidden />
          {d.addRoute}
        </Button>
        {error ? (
          <FieldError>{error}</FieldError>
        ) : (
          <FieldDescription>{d.routesHelp}</FieldDescription>
        )}
      </div>
      <ChoiceField
        id="rule-default"
        label={d.defaultRoute}
        help={d.defaultHelp}
        value={defaultIndex === null ? NONE : String(defaultIndex)}
        options={[
          { value: NONE, label: d.noDefault },
          ...routes.map((r, i) => ({ value: String(i), label: selectorLabel(r, copy) })),
        ]}
        onChange={handleDefault}
      />
      {defaultIndex !== null && routes.length > 1 ? (
        <div className="flex flex-col gap-2">
          <FieldLabel>{d.alternatives}</FieldLabel>
          {routes.map((r, i) =>
            i === defaultIndex ? null : (
              <label
                // biome-ignore lint/suspicious/noArrayIndexKey: rows have no identity of their own.
                key={i}
                htmlFor={`rule-alt-${i}`}
                className="flex cursor-pointer items-center gap-2 text-body"
              >
                <Checkbox
                  id={`rule-alt-${i}`}
                  checked={alternatives.includes(i)}
                  onCheckedChange={(v) => handleAlternative(i, Boolean(v))}
                />
                {selectorLabel(r, copy)}
              </label>
            ),
          )}
          <FieldDescription>{d.alternativesHelp}</FieldDescription>
        </div>
      ) : null}
    </div>
  )
}
