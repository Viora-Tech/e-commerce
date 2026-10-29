'use client'

import { Search } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Spinner } from '@commerce/ui/shadcn/spinner'
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
import { type TryPinResult, toPaise } from './format'
import TryPinCards from './try-pin-cards'
import TryPinTrace from './try-pin-trace'

type TryPinCardProps = {
  result: TryPinResult | null
  onResult: (result: TryPinResult) => void
}

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
  const [declineInsurance, setDeclineInsurance] = useState(false)
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleRun = async () => {
    setBusy(true)
    try {
      onResult(
        await api.deliveryOptions.tryPin({
          pincode: pincode.trim(),
          valuePaise: toPaise(value) ?? 0,
          weightGrams: Math.max(1, Math.round(Number(weight) || 500)),
          productIds,
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
  const ready = /^[1-9]\d{5}$/.test(pincode.trim())
  const tabs = itemTabs(discountCopy.value, locale).filter((x) => x.key === 'products')

  return (
    <SettingsCard title={t.title} description={t.description}>
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
        <Field>
          <FieldLabel htmlFor="try-weight">{t.weight}</FieldLabel>
          <MoneyInput id="try-weight" value={weight} onChange={setWeight} currency={false} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={() => setPicking(true)}>
          {t.pickProducts}
        </Button>
        <span className="text-body text-muted-foreground">
          {copy.ruleDialog.picked(productIds.length)}
        </span>
      </div>
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
