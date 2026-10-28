'use client'

import type { DomainView, MarketView } from '@commerce/core'
import { MARKET_CURRENCIES } from '@commerce/core/markets'
import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { useState } from 'react'
import { toast } from 'sonner'
import FormDialog from '@/components/layout/form-dialog'
import NoticeBar from '@/components/layout/notice-bar'
import { marketsContent } from '@/data/markets'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import CountryPicker from './country-picker'
import {
  domainOptions,
  formOf,
  formProblems,
  type MarketForm,
  marketInput,
  withCountries,
} from './market-form'
import MarketLanguageFields from './market-language-fields'
import MarketPricingFields from './market-pricing-fields'
import MarketReachField from './market-reach-field'

type MarketDialogProps = {
  /** The market being changed; null adds a new one. */
  market: MarketView | null
  /** Every market of the store, for countries already taken and addresses already in use. */
  markets: MarketView[]
  domains: DomainView[]
  onClose: () => void
  onSaved: () => void
}

/** Every market but the one in the dialog. */
function otherMarkets(markets: MarketView[], market: MarketView | null): MarketView[] {
  return markets.filter((m) => m.id !== market?.id)
}

/**
 * Add or change a market. The primary market only takes a name and languages: its country,
 * currency and prices are the store's own.
 */
export default function MarketDialog({
  market,
  markets,
  domains,
  onClose,
  onSaved,
}: MarketDialogProps) {
  // Hooks
  const copy = useCopy(marketsContent)
  const [form, setForm] = useState<MarketForm>(() => formOf(market))
  const [tried, setTried] = useState(false)

  // Helpers
  const patch = (next: Partial<MarketForm>) => setForm((f) => ({ ...f, ...next }))
  // Empty fields only count once the merchant has tried to save.
  const problemsOf = (missing: boolean) =>
    formProblems(
      form,
      otherMarkets(markets, market),
      market?.isPrimary ?? false,
      copy.dialog,
      missing,
    )
  const currencyLabel = (code: string) => `${code} · ${copy.currencies[code] ?? code}`

  // Event handlers
  const handleCountries = (countries: string[]) => {
    setForm((f) => withCountries(f, countries, otherMarkets(markets, market)))
  }
  const handleSubmit = async () => {
    setTried(true)
    if (Object.keys(problemsOf(true)).length > 0) return
    try {
      if (market?.isPrimary) {
        await api.markets.update({
          id: market.id,
          name: form.name.trim(),
          locale: form.locale,
          locales: form.locales,
        })
      } else if (market) {
        await api.markets.update({ id: market.id, ...marketInput(form) })
      } else {
        await api.markets.create(marketInput(form))
      }
      toast.success(market ? copy.toasts.saved : copy.toasts.added(form.name.trim()))
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.toasts.failed)
      throw err
    }
  }

  // Render logic
  const d = copy.dialog
  const isPrimary = market?.isPrimary ?? false
  const others = otherMarkets(markets, market)
  const shown = problemsOf(tried)
  const taken = Object.fromEntries(others.flatMap((m) => m.countries.map((c) => [c, m.name])))
  const storeCurrency = markets.find((m) => m.isPrimary)?.currency ?? 'INR'
  const primaryHost = domains.find((dm) => dm.isPrimary)?.hostname ?? ''
  const currencies: readonly string[] = (MARKET_CURRENCIES as readonly string[]).includes(
    form.currency,
  )
    ? MARKET_CURRENCIES
    : [form.currency, ...MARKET_CURRENCIES]

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={market ? d.editTitle(market.name) : d.addTitle}
      submitLabel={market ? d.save : d.add}
      onSubmit={handleSubmit}
      size="lg"
    >
      <div className="-mx-4 flex max-h-[60dvh] flex-col gap-5 overflow-y-auto overscroll-contain px-4">
        {isPrimary ? <NoticeBar>{d.primaryNote}</NoticeBar> : null}
        <Field data-invalid={shown.name ? true : undefined}>
          <FieldLabel htmlFor="market-name">{d.name}</FieldLabel>
          <Input
            id="market-name"
            value={form.name}
            maxLength={80}
            placeholder={d.namePlaceholder}
            aria-invalid={shown.name ? true : undefined}
            onChange={(e) => patch({ name: e.target.value })}
          />
          {shown.name ? <FieldError>{shown.name}</FieldError> : null}
        </Field>
        {isPrimary ? null : (
          <>
            <Field data-invalid={shown.countries ? true : undefined}>
              <FieldLabel htmlFor="market-countries">{d.countries.label}</FieldLabel>
              <FieldDescription>{d.countries.help}</FieldDescription>
              <CountryPicker
                id="market-countries"
                value={form.countries}
                taken={taken}
                invalid={Boolean(shown.countries)}
                onChange={handleCountries}
              />
              {shown.countries ? <FieldError>{shown.countries}</FieldError> : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="market-currency">{d.currency.label}</FieldLabel>
              <Select
                value={form.currency}
                onValueChange={(v) => v && patch({ currency: String(v), currencyPicked: true })}
              >
                <SelectTrigger id="market-currency" className="w-full">
                  <SelectValue>{currencyLabel(form.currency)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c} value={c}>
                      {currencyLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>{d.currency.help}</FieldDescription>
            </Field>
          </>
        )}
        <MarketLanguageFields
          locale={form.locale}
          locales={form.locales}
          error={shown.languages}
          onChange={patch}
        />
        {isPrimary ? null : (
          <>
            <MarketReachField
              access={form.access}
              subfolder={form.subfolder}
              domainId={form.domainId}
              primaryHost={primaryHost}
              domains={domainOptions(domains, others)}
              subfolderError={shown.subfolder}
              domainError={shown.domain}
              onChange={patch}
            />
            <MarketPricingFields
              form={form}
              storeCurrency={storeCurrency}
              adjustmentError={shown.adjustment}
              rateError={shown.rate}
              onChange={patch}
            />
          </>
        )}
      </div>
    </FormDialog>
  )
}
