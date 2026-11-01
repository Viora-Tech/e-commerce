'use client'

import type { LocationBillingView } from '@commerce/core'
import { isPincodePattern } from '@commerce/core/shipping-rates'
import { parseRupees } from '@commerce/money'
import { Save } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import TextField from '@/components/apps/gst-invoices/text-field'
import ToggleRow from '@/components/apps/gst-invoices/toggle-row'
import SettingsCard from '@/components/settings/settings-card'
import { localDeliveryContent } from '@/data/local-delivery'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type LocationLocalDeliveryCardProps = {
  location: LocationBillingView
  canManage: boolean
}

/** PIN codes as typed: one per line or comma separated, spaces dropped. */
const splitPincodes = (text: string): string[] =>
  [...new Set(text.split(/[\n,;]+/).map((p) => p.replace(/\s/g, '')))].filter(Boolean)

/** Paise as the rupees the field shows; null is an empty field. */
const rupeesText = (paise: number | null | undefined): string =>
  paise === null || paise === undefined ? '' : String(paise / 100)

/** Typed rupees as paise; empty (or not a number) is null. */
const paiseOf = (text: string): number | null => (text.trim() ? parseRupees(text) : null)

/**
 * Local delivery from one location (audit #163): its PIN codes, price, minimum order, free-above
 * value and instructions. Checkout offers it beside the zone rates (core `local-options.ts`).
 */
export default function LocationLocalDeliveryCard({
  location,
  canManage,
}: LocationLocalDeliveryCardProps) {
  // Hooks
  const { local: copy } = useCopy(localDeliveryContent)
  const router = useRouter()
  const [on, setOn] = useState(location.localDelivery?.enabled ?? false)
  const [pincodes, setPincodes] = useState((location.localDelivery?.pincodes ?? []).join('\n'))
  const [price, setPrice] = useState(rupeesText(location.localDelivery?.pricePaise ?? 0))
  const [minOrder, setMinOrder] = useState(rupeesText(location.localDelivery?.minOrderPaise))
  const [freeAbove, setFreeAbove] = useState(rupeesText(location.localDelivery?.freeAbovePaise))
  const [instructions, setInstructions] = useState(location.localDelivery?.instructions ?? '')
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)

  // Helpers
  const pincodeError = (list: string[]): string | null => {
    const bad = list.filter((p) => !isPincodePattern(p))
    if (bad.length > 0) return copy.invalid(bad.join(', '))
    return list.length === 0 ? copy.needPincodes : null
  }

  // Event handlers
  const handleSave = async () => {
    setAttempted(true)
    const list = splitPincodes(pincodes)
    if (on && pincodeError(list)) return
    setSaving(true)
    try {
      // Off with nothing saved stays null; off after setting it up keeps the details.
      const keep = on || location.localDelivery !== null
      await api.businessGst.setLocationLocalDelivery({
        locationId: location.id,
        localDelivery: keep
          ? {
              enabled: on,
              pincodes: list.filter(isPincodePattern),
              pricePaise: paiseOf(price) ?? 0,
              minOrderPaise: paiseOf(minOrder),
              freeAbovePaise: paiseOf(freeAbove),
              instructions,
            }
          : null,
      })
      toast.success(copy.saved)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const error = attempted ? pincodeError(splitPincodes(pincodes)) : null
  const disabled = !canManage || saving

  return (
    <SettingsCard title={copy.heading} description={copy.help} bodyClassName="flex flex-col gap-4">
      <ToggleRow
        id="location-local-delivery"
        label={copy.toggle}
        checked={on}
        onChange={(next) => (disabled ? undefined : setOn(next))}
      />
      {on ? (
        <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <TextField
              id="local-pincodes"
              label={copy.pincodes}
              value={pincodes}
              onChange={setPincodes}
              help={copy.pincodesHelp}
              error={error ?? undefined}
              multiline
            />
          </div>
          <TextField
            id="local-price"
            label={copy.price}
            value={price}
            onChange={setPrice}
            help={copy.priceHelp}
            inputMode="numeric"
          />
          <TextField
            id="local-min-order"
            label={copy.minOrder}
            value={minOrder}
            onChange={setMinOrder}
            help={copy.minOrderHelp}
            inputMode="numeric"
          />
          <TextField
            id="local-free-above"
            label={copy.freeAbove}
            value={freeAbove}
            onChange={setFreeAbove}
            help={copy.freeAboveHelp}
            inputMode="numeric"
          />
          <div className="sm:col-span-3">
            <TextField
              id="local-instructions"
              label={copy.instructions}
              value={instructions}
              onChange={setInstructions}
              help={copy.instructionsHelp}
              maxLength={500}
              multiline
            />
          </div>
        </fieldset>
      ) : (
        <p className="text-caption text-muted-foreground">{copy.off}</p>
      )}
      {canManage ? (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={disabled}>
            <Save aria-hidden="true" />
            {copy.save}
          </Button>
        </div>
      ) : null}
    </SettingsCard>
  )
}
