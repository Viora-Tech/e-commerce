'use client'

import { carrierSettingKey, type RouteSetting } from '@commerce/core/delivery-options'
import { parseRupees } from '@commerce/money'
import { Save, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@commerce/ui/shadcn/field'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import MoneyInput from '@/components/fields/money-input'
import SettingsToggleRow from '@/components/settings/settings-toggle-row'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { CARRIERS, toNumber, toRupees } from './format'

export type RouteSettingTarget =
  /** An exact route from Try a PIN, by key, with its name. */
  | { kind: 'exact'; key: string; label: string }
  /** A carrier through a channel, picked in the dialog. */
  | { kind: 'carrier' }

type RouteSettingDialogProps = {
  open: boolean
  target: RouteSettingTarget
  /** What is saved for it already. */
  current: RouteSetting | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

const CHANNELS = ['any', 'direct', 'aggregator', 'shiprocket', 'rapidshyp'] as const
const INSURES = ['default', 'yes', 'no'] as const

type Draft = {
  carrier: string
  channel: string
  insures: (typeof INSURES)[number]
  percent: string
  min: string
  first: string
  extra: string
  cod: string
  enabled: boolean
}

function parseKey(key: string): { carrier: string; channel: string } | null {
  const m = /^carrier:([^|]+)\|channel:(.+)$/.exec(key)
  return m ? { carrier: m[1] as string, channel: m[2] as string } : null
}

function draftOf(current: RouteSetting | null): Draft {
  const parsed = current ? parseKey(current.key) : null
  return {
    carrier: parsed?.carrier ?? 'delhivery',
    channel: parsed?.channel ?? 'any',
    insures: current?.insures == null ? 'default' : current.insures ? 'yes' : 'no',
    percent: current?.insurancePercent == null ? '' : String(current.insurancePercent),
    min: toRupees(current?.insuranceMinPaise),
    first: toRupees(current?.costCard?.firstHalfKgPaise),
    extra: toRupees(current?.costCard?.extraHalfKgPaise),
    cod: toRupees(current?.costCard?.codFeePaise),
    enabled: current?.enabled ?? true,
  }
}

/** The merchant's facts about one route: insures, insurance rate, cost card, on or off. */
export default function RouteSettingDialog({
  open,
  target,
  current,
  onOpenChange,
  onSaved,
}: RouteSettingDialogProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)
  const [draft, setDraft] = useState<Draft>(() => draftOf(current))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) setDraft(draftOf(current))
  }, [open, current])

  // Helpers
  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }))
  const keyOf = () =>
    target.kind === 'exact' ? target.key : carrierSettingKey(draft.carrier, draft.channel)
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await work()
      toast.success(copy.saved)
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Event handlers
  const handleSave = () => {
    const first = parseRupees(draft.first)
    return run(() =>
      api.deliveryOptions.saveRouteSetting({
        key: keyOf(),
        insures: draft.insures === 'default' ? null : draft.insures === 'yes',
        insurancePercent: toNumber(draft.percent),
        insuranceMinPaise: parseRupees(draft.min),
        costCard:
          first === null
            ? null
            : {
                firstHalfKgPaise: first,
                extraHalfKgPaise: parseRupees(draft.extra) ?? 0,
                codFeePaise: parseRupees(draft.cod) ?? 0,
              },
        enabled: draft.enabled,
      }),
    )
  }
  const handleRemove = () => run(() => api.deliveryOptions.deleteRouteSetting({ key: keyOf() }))

  // Render logic
  const d = copy.routeDialog
  const percentBad = draft.percent.trim() !== '' && toNumber(draft.percent) === null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {target.kind === 'exact' ? d.editTitle(target.label) : d.addTitle}
          </DialogTitle>
        </DialogHeader>
        <FieldGroup>
          {target.kind === 'carrier' ? (
            <div className="grid grid-cols-2 gap-3">
              <ChoiceField
                id="route-carrier"
                label={d.carrier}
                value={draft.carrier}
                options={CARRIERS.map((c) => ({ value: c.key, label: c.name }))}
                onChange={(carrier) => patch({ carrier })}
              />
              <ChoiceField
                id="route-channel"
                label={d.channel}
                value={draft.channel}
                options={CHANNELS.map((c) => ({ value: c, label: d.channels[c] }))}
                onChange={(channel) => patch({ channel })}
              />
            </div>
          ) : null}
          <ChoiceField
            id="route-insures"
            label={d.insures}
            help={d.insuresHelp}
            value={draft.insures}
            options={[
              { value: 'default', label: d.insuresDefault },
              { value: 'yes', label: copy.routes.yes },
              { value: 'no', label: copy.routes.no },
            ]}
            onChange={(v) => patch({ insures: v as Draft['insures'] })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field data-invalid={percentBad ? true : undefined}>
              <FieldLabel htmlFor="route-percent">{d.insuranceRate}</FieldLabel>
              <MoneyInput
                id="route-percent"
                value={draft.percent}
                onChange={(percent) => patch({ percent })}
                currency={false}
                suffix="%"
              />
              {percentBad ? <FieldError>{d.insuranceRateHelp}</FieldError> : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="route-min">{d.insuranceMin}</FieldLabel>
              <MoneyInput id="route-min" value={draft.min} onChange={(min) => patch({ min })} />
            </Field>
          </div>
          <FieldDescription>{d.insuranceRateHelp}</FieldDescription>
          <Field>
            <FieldLabel>{d.costCard}</FieldLabel>
            <div className="grid grid-cols-3 gap-3">
              <MoneyInput
                aria-label={d.firstHalfKg}
                placeholder={d.firstHalfKg}
                value={draft.first}
                onChange={(first) => patch({ first })}
              />
              <MoneyInput
                aria-label={d.extraHalfKg}
                placeholder={d.extraHalfKg}
                value={draft.extra}
                onChange={(extra) => patch({ extra })}
              />
              <MoneyInput
                aria-label={d.codFee}
                placeholder={d.codFee}
                value={draft.cod}
                onChange={(cod) => patch({ cod })}
              />
            </div>
            <FieldDescription>{d.costCardHelp}</FieldDescription>
          </Field>
          <SettingsToggleRow
            id="route-enabled"
            label={d.enabled}
            checked={draft.enabled}
            onChange={(enabled) => patch({ enabled })}
          />
        </FieldGroup>
        <DialogFooter>
          {current ? (
            <Button variant="ghost" className="mr-auto" onClick={handleRemove} disabled={busy}>
              <Trash2 aria-hidden />
              {d.remove}
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {copy.cancel}
          </Button>
          <Button onClick={handleSave} disabled={busy || percentBad}>
            <Save aria-hidden="true" />
            {copy.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
