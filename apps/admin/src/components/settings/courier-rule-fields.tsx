'use client'

import type { CourierRuleSettings } from '@commerce/core'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import { shippingSettingsContent } from '@/data/shipping'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type CourierRuleFieldsProps = {
  value: CourierRuleSettings | undefined
  onChange: (next: CourierRuleSettings) => void
}

type Courier = { id: string; label: string }

const MODES: CourierRuleSettings['mode'][] = ['cheapest', 'fastest', 'preferred', 'per_zone']

/** Blank zone rule for the "Add a rule" button. */
const blankZone = () => ({ stateCodes: [] as string[], providerId: '' })

/** Which mode a value renders as; unopinionated defaults keep the fields controlled from the
 *  first paint even before couriers have loaded. */
function modeOf(value: CourierRuleSettings | undefined): CourierRuleSettings['mode'] {
  return value?.mode ?? 'cheapest'
}

/** The store's default-courier rule, in Settings → Shipping. Self-fetches which couriers are
 *  actually connected (Settings → Shipping's own couriers plus any app-only courier like
 *  Shiprocket) so the "always use" and "by state" pickers only offer real choices. */
export default function CourierRuleFields({ value, onChange }: CourierRuleFieldsProps) {
  // Hooks
  const { courierRule: copy } = useCopy(shippingSettingsContent)
  const [couriers, setCouriers] = useState<Courier[] | null>(null)

  useEffect(() => {
    api.store.getShipping().then((r) => {
      const byId = new Map(r.available.map((p) => [p.id, p.label]))
      setCouriers(r.settings.enabled.map((id) => ({ id, label: byId.get(id) ?? id })))
    })
  }, [])

  // Event handlers
  const handleModeChange = (next: string) => {
    if (next === 'preferred') {
      onChange({ mode: 'preferred', providerId: couriers?.[0]?.id ?? '' })
    } else if (next === 'per_zone') {
      onChange({ mode: 'per_zone', zones: [blankZone()], fallback: 'cheapest' })
    } else {
      onChange({ mode: next as 'cheapest' | 'fastest' })
    }
  }

  const handleZoneChange = (
    i: number,
    patch: Partial<{ stateCodes: string[]; providerId: string }>,
  ) => {
    if (value?.mode !== 'per_zone') return
    const next = value.zones.map((z, idx) => (idx === i ? { ...z, ...patch } : z))
    onChange({ ...value, zones: next })
  }

  const handleRemoveZone = (i: number) => {
    if (value?.mode !== 'per_zone') return
    onChange({ ...value, zones: value.zones.filter((_, idx) => idx !== i) })
  }

  const handleAddZone = () => {
    if (value?.mode !== 'per_zone') return
    onChange({ ...value, zones: [...value.zones, blankZone()] })
  }

  const handleFallbackChange = (next: string) => {
    if (value?.mode === 'per_zone') {
      onChange({ ...value, fallback: next === 'fastest' ? 'fastest' : 'cheapest' })
    }
  }

  // Render logic
  const mode = modeOf(value)
  const preferredId = value?.mode === 'preferred' ? value.providerId : ''
  const zones = value?.mode === 'per_zone' ? value.zones : []
  const fallback = value?.mode === 'per_zone' ? value.fallback : 'cheapest'
  const courierItems = (couriers ?? []).map((c) => ({ value: c.id, label: c.label }))

  return (
    <DataCard title={copy.heading}>
      <div className="flex flex-col gap-4">
        <p className="text-body text-muted-foreground">{copy.intro}</p>

        {couriers !== null && couriers.length === 0 ? (
          <p className="text-body text-muted-foreground">{copy.noCourier}</p>
        ) : couriers !== null && couriers.length === 1 ? (
          <p className="text-body text-muted-foreground">{copy.oneCourier}</p>
        ) : (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="courier-rule-mode">{copy.mode.label}</FieldLabel>
              <Select value={mode} onValueChange={(v) => handleModeChange(String(v))}>
                <SelectTrigger id="courier-rule-mode" className="w-full sm:w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {copy.mode[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {mode === 'preferred' ? (
              <Field>
                <FieldLabel htmlFor="courier-rule-preferred">{copy.preferredLabel}</FieldLabel>
                <Select
                  items={courierItems}
                  value={preferredId}
                  onValueChange={(v) =>
                    onChange({ mode: 'preferred', providerId: String(v ?? '') })
                  }
                >
                  <SelectTrigger id="courier-rule-preferred" className="w-full sm:w-72">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {courierItems.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}

            {mode === 'per_zone' ? (
              <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
                <div>
                  <p className="text-body font-medium text-foreground">{copy.zonesHeading}</p>
                  <p className="text-caption text-muted-foreground">{copy.zonesHelp}</p>
                </div>
                {zones.map((zone, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: rows have no stable id, only position
                  <div key={i} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <Field>
                      <FieldLabel htmlFor={`courier-rule-zone-states-${i}`}>
                        {copy.zoneStates}
                      </FieldLabel>
                      <Input
                        id={`courier-rule-zone-states-${i}`}
                        value={zone.stateCodes.join(', ')}
                        onChange={(e) =>
                          handleZoneChange(i, {
                            stateCodes: e.target.value
                              .split(',')
                              .map((s) => s.trim().toUpperCase())
                              .filter(Boolean),
                          })
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`courier-rule-zone-courier-${i}`}>
                        {copy.zoneCourier}
                      </FieldLabel>
                      <Select
                        items={courierItems}
                        value={zone.providerId}
                        onValueChange={(v) => handleZoneChange(i, { providerId: String(v ?? '') })}
                      >
                        <SelectTrigger id={`courier-rule-zone-courier-${i}`} className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {courierItems.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Button variant="outline" size="sm" onClick={() => handleRemoveZone(i)}>
                      {copy.removeZone}
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-fit" onClick={handleAddZone}>
                  <Plus aria-hidden="true" />
                  {copy.addZone}
                </Button>
                <Field>
                  <FieldLabel htmlFor="courier-rule-fallback">{copy.fallbackLabel}</FieldLabel>
                  <Select value={fallback} onValueChange={(v) => handleFallbackChange(String(v))}>
                    <SelectTrigger id="courier-rule-fallback" className="w-full sm:w-72">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cheapest">{copy.mode.cheapest}</SelectItem>
                      <SelectItem value="fastest">{copy.mode.fastest}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldDescription>{copy.zonesHelp}</FieldDescription>
                </Field>
              </div>
            ) : null}
          </FieldGroup>
        )}
        <Button
          variant="outline"
          className="w-fit"
          nativeButton={false}
          render={<Link href={routes.apps.list()} />}
        >
          {copy.manage}
        </Button>
      </div>
    </DataCard>
  )
}
