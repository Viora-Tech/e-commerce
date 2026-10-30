'use client'

import type { CatalogSummary, DomainView, MarketView } from '@commerce/core'
import { MARKET_CURRENCIES } from '@commerce/core/markets'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { useState } from 'react'
import FormDialog from '@/components/layout/form-dialog'
import { marketsContent } from '@/data/markets'
import { useCopy } from '@/hooks/use-copy'
import { domainOptions, type FormProblems, formProblems, type MarketForm } from './market-form'
import MarketLanguageFields from './market-language-fields'
import MarketPricingFields from './market-pricing-fields'
import MarketReachField from './market-reach-field'

/** A part of a market not created yet that the New market page opens in a dialog. */
export type NewMarketPart = 'prices' | 'languages' | 'address' | 'catalog'

type NewMarketPartDialogProps = {
  part: NewMarketPart
  /** The page's market as typed so far; the dialog changes a copy and hands it back. */
  form: MarketForm
  catalogId: string | null
  markets: MarketView[]
  domains: DomainView[]
  catalogs: CatalogSummary[]
  storeCurrency: string
  title: string
  onApply: (form: MarketForm, catalogId: string | null) => void
  onClose: () => void
}

/** Which form problems belong to each part; the others wait for their own row. */
const PART_PROBLEMS: Record<NewMarketPart, (keyof FormProblems)[]> = {
  prices: ['adjustment', 'rate'],
  languages: ['languages', 'subfolder'],
  address: ['subfolder', 'domain'],
  catalog: [],
}

/** Select value for "no catalog": every product, the store default. */
const ALL = 'all'

/**
 * One part of the New market page, in a dialog built from the market dialog's own fields. Nothing
 * is saved here: Done hands the changed form back, and the page creates the market at the end.
 */
export default function NewMarketPartDialog({
  part,
  form,
  catalogId,
  markets,
  domains,
  catalogs,
  storeCurrency,
  title,
  onApply,
  onClose,
}: NewMarketPartDialogProps) {
  // Hooks
  const copy = useCopy(marketsContent)
  const [draft, setDraft] = useState<MarketForm>(form)
  const [catalog, setCatalog] = useState<string>(catalogId ?? ALL)
  const [tried, setTried] = useState(false)

  // Helpers
  const patch = (next: Partial<MarketForm>) => setDraft((f) => ({ ...f, ...next }))
  const problemsOf = (missing: boolean) => {
    const all = formProblems(draft, markets, false, copy.dialog, missing)
    const picked: FormProblems = {}
    for (const key of PART_PROBLEMS[part]) {
      if (all[key]) picked[key] = all[key]
    }
    return picked
  }
  const currencyLabel = (code: string) => `${code} · ${copy.currencies[code] ?? code}`

  // Event handlers
  const handleSubmit = () => {
    setTried(true)
    if (Object.keys(problemsOf(true)).length > 0) return
    onApply(draft, catalog === ALL ? null : catalog)
  }

  // Render logic
  const d = copy.dialog
  const n = copy.newPage
  const shown = problemsOf(tried)
  const primaryHost = domains.find((dm) => dm.isPrimary)?.hostname ?? ''
  const currencies: readonly string[] = (MARKET_CURRENCIES as readonly string[]).includes(
    draft.currency,
  )
    ? MARKET_CURRENCIES
    : [draft.currency, ...MARKET_CURRENCIES]
  const catalogLabel = (id: string) =>
    id === ALL ? n.catalogAll : (catalogs.find((c) => c.id === id)?.name ?? n.catalogAll)

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={title}
      submitLabel={n.apply}
      onSubmit={handleSubmit}
      size={part === 'prices' || part === 'address' ? 'lg' : 'md'}
    >
      <div className="-mx-4 flex max-h-[60dvh] flex-col gap-5 overflow-y-auto overscroll-contain px-4">
        {part === 'prices' ? (
          <>
            <Field>
              <FieldLabel htmlFor="new-market-currency">{d.currency.label}</FieldLabel>
              <Select
                value={draft.currency}
                onValueChange={(v) => v && patch({ currency: String(v), currencyPicked: true })}
              >
                <SelectTrigger id="new-market-currency" className="w-full">
                  <SelectValue>{currencyLabel(draft.currency)}</SelectValue>
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
            <MarketPricingFields
              form={draft}
              storeCurrency={storeCurrency}
              adjustmentError={shown.adjustment}
              rateError={shown.rate}
              onChange={patch}
            />
          </>
        ) : null}
        {part === 'languages' ? (
          <MarketLanguageFields
            locale={draft.locale}
            locales={draft.locales}
            error={shown.languages ?? shown.subfolder}
            onChange={patch}
          />
        ) : null}
        {part === 'address' ? (
          <MarketReachField
            access={draft.access}
            subfolder={draft.subfolder}
            domainId={draft.domainId}
            primaryHost={primaryHost}
            domains={domainOptions(domains, markets)}
            subfolderError={shown.subfolder}
            domainError={shown.domain}
            onChange={patch}
          />
        ) : null}
        {part === 'catalog' ? (
          <Field>
            <FieldLabel htmlFor="new-market-catalog">{n.catalogLabel}</FieldLabel>
            <Select value={catalog} onValueChange={(v) => v && setCatalog(String(v))}>
              <SelectTrigger id="new-market-catalog" className="w-full">
                <SelectValue>{catalogLabel(catalog)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{n.catalogAll}</SelectItem>
                {catalogs.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>{n.catalogHelp}</FieldDescription>
          </Field>
        ) : null}
      </div>
    </FormDialog>
  )
}
