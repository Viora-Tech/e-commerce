'use client'

import { parseRupees } from '@commerce/money'
import { Search } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import { useState } from 'react'
import { toast } from 'sonner'
import { itemTabs } from '@/components/discounts/pick-sources'
import MoneyInput from '@/components/fields/money-input'
import ResourcePickDialog from '@/components/pickers/resource-pick-dialog'
import SettingsCard from '@/components/settings/settings-card'
import SettingsToggleRow from '@/components/settings/settings-toggle-row'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { discountFormContent } from '@/data/discounts'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { TryPinResult } from './format'
import TryPinCards from './try-pin-cards'
import TryPinLines, { type TryPinLine } from './try-pin-lines'
import TryPinTrace from './try-pin-trace'

type TryPinCardProps = {
  result: TryPinResult | null
  onResult: (result: TryPinResult) => void
}

type Mode = 'typed' | 'picked'
const MODES: readonly Mode[] = ['typed', 'picked']

/** Grams as kilograms for the "priced as" line: 6554 → "6.55". */
const kg = (grams: number) => (grams / 1000).toFixed(2).replace(/\.?0+$/, '')

/** Try a PIN: a PIN and a cart in, the cards checkout would draw and every route's quote out. */
export default function TryPinCard({ result, onResult }: TryPinCardProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)
  const discountCopy = useCopy(discountFormContent)
  const locale = useLocale()
  const [pincode, setPincode] = useState('')
  const [value, setValue] = useState('1500')
  const [weight, setWeight] = useState('500')
  const [productIds, setProductIds] = useState<string[]>([])
  const [mode, setMode] = useState<Mode>('typed')
  const [lines, setLines] = useState<TryPinLine[]>([])
  const [declineInsurance, setDeclineInsurance] = useState(false)
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleMode = (values: string[]) => {
    const next = MODES.find((m) => m === values[0])
    if (next) setMode(next)
  }

  const handleLines = (next: TryPinLine[]) => {
    setLines(next)
    // The order value follows the picked goods; the merchant may still change it.
    setValue(String(next.reduce((sum, l) => sum + l.quantity * l.unitPricePaise, 0) / 100))
  }

  const handleRun = async () => {
    setBusy(true)
    try {
      onResult(
        await api.deliveryOptions.tryPin({
          pincode: pincode.trim(),
          valuePaise: parseRupees(value) ?? 0,
          weightGrams: Math.max(1, Math.round(Number(weight) || 500)),
          productIds,
          ...(picked
            ? { lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })) }
            : {}),
          declineInsurance,
        }),
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const t = copy.tryPin
  const picked = mode === 'picked'
  const ready = /^[1-9]\d{5}$/.test(pincode.trim()) && (!picked || lines.length > 0)
  const parcel = result?.parcel ?? null
  const box = parcel?.dimensionsCm
    ? `${parcel.dimensionsCm.lengthCm} × ${parcel.dimensionsCm.widthCm} × ${parcel.dimensionsCm.heightCm}`
    : null
  const tabs = itemTabs(discountCopy.value, locale).filter((x) => x.key === 'products')

  return (
    <SettingsCard title={t.title} description={t.description}>
      <Field>
        <FieldLabel>{t.mode}</FieldLabel>
        <ToggleGroup
          aria-label={t.mode}
          value={[mode]}
          onValueChange={handleMode}
          variant="outline"
          spacing={0}
        >
          {MODES.map((m) => (
            <ToggleGroupItem key={m} value={m} className="px-3">
              {t.modes[m]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field>
          <FieldLabel htmlFor="try-pin">{t.pincode}</FieldLabel>
          <Input
            id="try-pin"
            inputMode="numeric"
            maxLength={6}
            value={pincode}
            onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="try-value">{t.value}</FieldLabel>
          <MoneyInput id="try-value" value={value} onChange={setValue} />
        </Field>
        {picked ? null : (
          <Field>
            <FieldLabel htmlFor="try-weight">{t.weight}</FieldLabel>
            <MoneyInput id="try-weight" value={weight} onChange={setWeight} currency={false} />
          </Field>
        )}
      </div>
      {picked ? (
        <TryPinLines lines={lines} onChange={handleLines} />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => setPicking(true)}>
            {t.ruleProducts}
          </Button>
          <span className="text-body text-muted-foreground">
            {copy.ruleDialog.picked(productIds.length)}
          </span>
        </div>
      )}
      <SettingsToggleRow
        id="try-decline-insurance"
        label={t.declineInsurance}
        checked={declineInsurance}
        onChange={setDeclineInsurance}
      />
      <div className="flex justify-end">
        <Button onClick={handleRun} disabled={!ready || busy}>
          {busy ? <Spinner /> : <Search aria-hidden />}
          {busy ? t.running : t.run}
        </Button>
      </div>
      {result ? (
        <div className="flex flex-col gap-5 border-t border-hairline pt-4">
          {parcel ? (
            <p className="text-body text-muted-foreground">
              {t.pricedAs(kg(parcel.billedGrams), box)}
            </p>
          ) : null}
          <TryPinCards result={result} />
          <TryPinTrace result={result} />
        </div>
      ) : null}
      <ResourcePickDialog
        open={picking}
        title={t.pickProducts}
        tabs={tabs}
        selected={{ tab: 'products', ids: productIds }}
        onClose={() => setPicking(false)}
        onDone={(r) => {
          setProductIds(r.ids)
          setPicking(false)
        }}
      />
    </SettingsCard>
  )
}
