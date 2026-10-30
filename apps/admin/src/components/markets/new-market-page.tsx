'use client'

import type { CatalogSummary, DomainView, MarketView } from '@commerce/core'
import { ChevronRight, Earth } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import type { StoreDefaults } from '@/app/(admin)/markets/load'
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
import ProoflyDetailPage from '@/components/layout/proofly-detail-page'
import StatusChip from '@/components/layout/status-chip'
import { marketsContent } from '@/data/markets'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import CountryPicker from './country-picker'
import { formOf, formProblems, type MarketForm, marketInput, withCountries } from './market-form'
import { adjustmentText } from './market-overrides'
import NewMarketPartDialog, { type NewMarketPart } from './new-market-part-dialog'

type NewMarketPageProps = {
  /** Every market of the store: countries already taken, addresses in use, the defaults. */
  markets: MarketView[]
  domains: DomainView[]
  catalogs: CatalogSummary[]
  defaults: StoreDefaults
}

/** One inherited setting: its value now, whether it still is the store default, what opens it. */
type InheritRow = {
  key: string
  label: string
  value: string
  changed: boolean
  part?: NewMarketPart
  note?: string | undefined
}

const ROW =
  'flex w-full min-w-0 items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none'

/** A new market starts from the primary market: the store's currency and languages. */
function startingForm(primary: MarketView | undefined): MarketForm {
  const blank = formOf(null)
  return {
    ...blank,
    currency: primary?.currency ?? 'INR',
    locale: primary?.locale ?? blank.locale,
    locales: primary?.locales ?? blank.locales,
  }
}

/**
 * Markets › New market (audit #118), like Shopify's: a name and countries, then every setting the
 * market inherits from the store defaults, each with its value and a "Store default" or "Changed"
 * chip. A row opens its part in a dialog; nothing is saved until Create market.
 */
export default function NewMarketPage({
  markets,
  domains,
  catalogs,
  defaults,
}: NewMarketPageProps) {
  // Hooks
  const copy = useCopy(marketsContent)
  const router = useRouter()
  const [form, setForm] = useState<MarketForm>(() =>
    startingForm(markets.find((m) => m.isPrimary)),
  )
  const [catalogId, setCatalogId] = useState<string | null>(null)
  const [part, setPart] = useState<NewMarketPart | null>(null)
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)

  // Helpers
  const problemsOf = (missing: boolean) => formProblems(form, markets, false, copy.dialog, missing)

  // Event handlers
  const handleApply = (next: MarketForm, nextCatalog: string | null) => {
    setForm(next)
    setCatalogId(nextCatalog)
    setPart(null)
  }
  const handleCreate = async () => {
    setTried(true)
    if (Object.keys(problemsOf(true)).length > 0) return
    setBusy(true)
    try {
      const created = await api.markets.create(marketInput(form))
      const catalog = catalogs.find((c) => c.id === catalogId)
      if (catalog) {
        try {
          await api.catalogs.update({
            id: catalog.id,
            marketIds: [...catalog.markets.map((m) => m.id), created.id],
          })
        } catch {
          toast.error(copy.newPage.catalogFailed)
        }
      }
      toast.success(copy.toasts.added(form.name.trim()))
      router.push(routes.markets.detail(created.id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.toasts.failed)
      setBusy(false)
    }
  }

  // Render logic
  const n = copy.newPage
  const d = copy.dialog
  const h = copy.hub
  const shown = problemsOf(tried)
  const primary = markets.find((m) => m.isPrimary)
  const storeCurrency = primary?.currency ?? 'INR'
  const primaryHost = domains.find((dm) => dm.isPrimary)?.hostname ?? ''
  const taken = Object.fromEntries(markets.flatMap((m) => m.countries.map((c) => [c, m.name])))
  const languageName = (code: string) => copy.languages[code] ?? code
  const baseLanguages = primary ? [primary.locale, ...primary.locales] : ['en']
  const languages = [form.locale, ...form.locales]
  const catalog = catalogs.find((c) => c.id === catalogId) ?? null
  const address =
    form.access === 'subfolder'
      ? `${primaryHost}/${form.subfolder.trim() || '…'}`
      : form.access === 'domain'
        ? (domains.find((dm) => dm.id === form.domainId)?.hostname ?? d.reach.domainPick)
        : d.reach.choice
  const adjustment = Number(form.adjustment.trim() || '0')
  const pricesChanged =
    form.currency !== storeCurrency ||
    adjustment !== 0 ||
    form.rounding !== 'none' ||
    form.rate.trim() !== ''
  const rows: InheritRow[] = [
    {
      key: 'prices',
      label: n.rows.prices,
      value: h.prices(
        `${form.currency} · ${copy.currencies[form.currency] ?? form.currency}`,
        adjustment === 0
          ? h.noAdjustment
          : h.adjustment(adjustmentText(Math.round(adjustment * 100))),
        form.rounding === 'none' ? '' : (d.pricing.roundings[form.rounding] ?? ''),
      ),
      changed: pricesChanged,
      part: 'prices',
      note: shown.adjustment ?? shown.rate,
    },
    {
      key: 'catalog',
      label: n.rows.catalog,
      value: catalog
        ? h.catalogOf(
            catalog.name,
            catalog.scope === 'all'
              ? h.catalogAllProducts
              : h.catalogProducts(catalog.productCount),
          )
        : n.catalogAll,
      changed: catalog !== null,
      part: catalogs.length > 0 ? 'catalog' : undefined,
    },
    {
      key: 'discounts',
      label: n.rows.discounts,
      value: n.discounts(defaults.discountCount),
      changed: false,
      note: n.discountsNote,
    },
    {
      key: 'address',
      label: n.rows.address,
      value: address,
      changed: form.access !== 'subfolder',
      part: 'address',
      note: shown.subfolder ?? shown.domain,
    },
    {
      key: 'languages',
      label: n.rows.languages,
      value: languages.map(languageName).join(', '),
      changed: languages.join(',') !== baseLanguages.join(','),
      part: 'languages',
    },
    {
      key: 'taxes',
      label: n.rows.taxes,
      value: n.taxes(
        copy.graph.taxes(defaults.gstRatePercent),
        form.duties === 'ddp' ? d.duties.ddp : d.duties.dap,
      ),
      changed: form.duties !== 'dap',
      part: 'prices',
    },
    {
      key: 'shipping',
      label: n.rows.shipping,
      value: n.shipping,
      changed: false,
      note: n.shippingNote,
    },
  ]
  const errorKeys = new Set(['prices', 'address'])

  return (
    <ProoflyDetailPage
      header={
        <PageHeader
          title={n.title}
          summary={n.summary}
          back={{ label: n.back, href: routes.markets.list() }}
          lead={{ kind: 'icon', node: <Earth aria-hidden="true" /> }}
          size="sm"
        />
      }
      main={
        <>
          <DataCard title={n.basics} bodyClassName="flex flex-col gap-5">
            <Field data-invalid={shown.name ? true : undefined}>
              <FieldLabel htmlFor="new-market-name">{d.name}</FieldLabel>
              <Input
                id="new-market-name"
                value={form.name}
                maxLength={80}
                placeholder={d.namePlaceholder}
                aria-invalid={shown.name ? true : undefined}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              {shown.name ? <FieldError>{shown.name}</FieldError> : null}
            </Field>
            <Field data-invalid={shown.countries ? true : undefined}>
              <FieldLabel htmlFor="new-market-countries">{d.countries.label}</FieldLabel>
              <FieldDescription>{d.countries.help}</FieldDescription>
              <CountryPicker
                id="new-market-countries"
                value={form.countries}
                taken={taken}
                invalid={Boolean(shown.countries)}
                onChange={(countries) => setForm((f) => withCountries(f, countries, markets))}
              />
              {shown.countries ? <FieldError>{shown.countries}</FieldError> : null}
            </Field>
          </DataCard>
          <DataCard
            title={n.settings}
            subtitle={n.settingsNote}
            bodyClassName="p-0"
            footer={
              <>
                <Button
                  variant="outline"
                  render={<Link href={routes.markets.list()} />}
                  nativeButton={false}
                >
                  {n.cancel}
                </Button>
                <Button onClick={handleCreate} disabled={busy}>
                  {n.create}
                </Button>
              </>
            }
          >
            <ul className="flex flex-col divide-y divide-border">
              {rows.map((row) => {
                const body = (
                  <>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-ink-strong">{row.label}</span>
                        <StatusChip tone={row.changed ? 'info' : 'neutral'}>
                          {row.changed ? n.changed : n.storeDefault}
                        </StatusChip>
                      </span>
                      <span className="truncate text-caption text-muted-foreground">
                        {row.value}
                      </span>
                      {row.note ? (
                        <span
                          className={
                            errorKeys.has(row.key)
                              ? 'text-caption text-destructive'
                              : 'text-caption text-muted-foreground/80'
                          }
                        >
                          {row.note}
                        </span>
                      ) : null}
                    </span>
                    {row.part ? (
                      <ChevronRight
                        aria-hidden="true"
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                    ) : null}
                  </>
                )
                return (
                  <li key={row.key}>
                    {row.part ? (
                      <button
                        type="button"
                        className={ROW}
                        aria-label={n.change(row.label)}
                        onClick={() => setPart(row.part ?? null)}
                      >
                        {body}
                      </button>
                    ) : (
                      <div className="flex min-w-0 items-center gap-4 px-4 py-3.5">{body}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          </DataCard>
        </>
      }
    >
      {part ? (
        <NewMarketPartDialog
          part={part}
          form={form}
          catalogId={catalogId}
          markets={markets}
          domains={domains}
          catalogs={catalogs}
          storeCurrency={storeCurrency}
          title={n.change(rows.find((r) => r.part === part)?.label ?? n.title)}
          onApply={handleApply}
          onClose={() => setPart(null)}
        />
      ) : null}
    </ProoflyDetailPage>
  )
}
