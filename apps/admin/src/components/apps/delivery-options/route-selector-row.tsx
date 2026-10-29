'use client'

import type { RouteSelector } from '@commerce/core/delivery-options'
import { X } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { useCopy } from '@/hooks/use-copy'
import { CARRIERS } from './format'

type RouteSelectorRowProps = {
  id: string
  value: RouteSelector
  onChange: (next: RouteSelector) => void
  onRemove?: (() => void) | undefined
}

const CHANNELS = ['any', 'direct', 'aggregator', 'shiprocket', 'rapidshyp'] as const
const SPEEDS = ['any', 'standard', 'express'] as const

/** One allowed route in a rule or option: courier, channel and speed. */
export default function RouteSelectorRow({ id, value, onChange, onRemove }: RouteSelectorRowProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)

  // Render logic
  const d = copy.routeDialog
  const carriers = CARRIERS.some((c) => c.key === value.carrier)
    ? CARRIERS
    : [...CARRIERS, { key: value.carrier, name: value.carrier }]

  return (
    <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
      <ChoiceField
        id={`${id}-carrier`}
        label={d.carrier}
        value={value.carrier}
        options={carriers.map((c) => ({ value: c.key, label: c.name }))}
        onChange={(carrier) => onChange({ ...value, carrier })}
      />
      <ChoiceField
        id={`${id}-channel`}
        label={d.channel}
        value={value.channel ?? 'any'}
        options={CHANNELS.map((c) => ({ value: c, label: d.channels[c] }))}
        onChange={(channel) => onChange({ ...value, channel })}
      />
      <ChoiceField
        id={`${id}-speed`}
        label={copy.route.speed}
        value={value.speed ?? 'any'}
        options={SPEEDS.map((s) => ({ value: s, label: copy.ruleDialog.speeds[s] }))}
        onChange={(speed) => onChange({ ...value, speed: speed as RouteSelector['speed'] })}
      />
      {onRemove ? (
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={copy.ruleDialog.removeRoute}
          onClick={onRemove}
        >
          <X aria-hidden />
        </Button>
      ) : (
        <span />
      )}
    </div>
  )
}
