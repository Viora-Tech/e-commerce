'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Input } from '@commerce/ui/shadcn/input'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@commerce/ui/shadcn/table'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import PillTabs from '@/components/layout/pill-tabs'
import TableEmptyRow from '@/components/table/table-empty-row'
import { gstProductTaxContent } from '@/data/gst-product-tax'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import ChoiceField from './choice-field'
import ProductsTaxRow from './products-tax-row'
import { HEAD } from './table-classes'

type Data = Awaited<ReturnType<typeof api.gstInvoicesProducts.list>>
type Filter = 'all' | 'missing_hsn' | 'missing_rate' | 'gst_off'
type Change = { hsCode?: string | null; gstRatePercent?: number | null; taxable?: boolean }
type Target = { ids: string[] } | { match: { filter: Filter; search?: string | undefined } }

const FILTERS: Filter[] = ['all', 'missing_hsn', 'missing_rate', 'gst_off']
const RATES = [0, 3, 5, 12, 18, 28, 40]
const PER_PAGE = 50
const SEARCH_SETTLE_MS = 300
const STORE = 'store'
const NONE = ''

/** The GST invoices app's Products tab: Charge GST, rate and HSN for every product. */
export default function ProductsTaxPage() {
  // Hooks
  const copy = useCopy(gstProductTaxContent)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Data | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [allMatching, setAllMatching] = useState(false)
  const [bulkHsn, setBulkHsn] = useState('')
  const [busy, setBusy] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), SEARCH_SETTLE_MS)
    return () => clearTimeout(timer)
  }, [search])

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reload` refetches after a save
  useEffect(() => {
    let active = true
    api.gstInvoicesProducts
      .list({ filter, search: query || undefined, page, perPage: PER_PAGE })
      .then(
        (next) => active && setData(next),
        () => active && toast.error(copy.loadFailed),
      )
    return () => {
      active = false
    }
  }, [filter, query, page, reload, copy.loadFailed])

  // Event handlers
  const save = async (to: Target, change: Change) => {
    setBusy(true)
    try {
      const r = await api.gstInvoicesProducts.update({ target: to, change })
      toast.success(copy.saved(r.products))
      setReload((n) => n + 1)
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }
  const handleFilter = (next: Filter) => {
    setFilter(next)
    setPage(1)
    setSelected([])
    setAllMatching(false)
  }
  const handleSelect = (id: string, on: boolean) => {
    setAllMatching(false)
    setSelected((s) => (on ? [...s, id] : s.filter((x) => x !== id)))
  }
  const handleSelectPage = (on: boolean) => {
    setAllMatching(false)
    setSelected((s) =>
      on ? [...new Set([...s, ...pageIds])] : s.filter((x) => !pageIds.includes(x)),
    )
  }
  const handleClear = () => {
    setSelected([])
    setAllMatching(false)
  }
  const handleBulkHsn = () => {
    const next = bulkHsn.trim()
    if (next && !/^\d{4,8}$/.test(next)) {
      toast.error(copy.hsnInvalid)
      return
    }
    void save(target, { hsCode: next || null })
  }
  const handleBulkRate = (value: string) => {
    if (value === NONE) return
    void save(target, { gstRatePercent: value === STORE ? null : Number(value) })
  }

  // Render logic
  const items = data?.items ?? []
  const total = data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PER_PAGE))
  const storeRate = data?.storeRatePercent ?? 18
  const rateOptions = [
    { value: STORE, label: copy.storeRate(storeRate) },
    ...RATES.map((r) => ({ value: String(r), label: copy.rate(r) })),
  ]
  const pageIds = items.map((r) => r.id)
  const pageSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id))
  const chosen = allMatching ? total : selected.length
  const target: Target = allMatching
    ? { match: { filter, search: query || undefined } }
    : { ids: selected }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={copy.title} subtitle={copy.intro} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PillTabs
          tabs={FILTERS.map((f) => ({ value: f, label: copy.filters[f] }))}
          value={filter}
          onChange={handleFilter}
        />
        <Input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          placeholder={copy.search}
          aria-label={copy.search}
          className="w-full sm:w-64"
        />
      </div>

      {chosen > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
          <span className="text-body font-medium">
            {allMatching ? copy.allMatching(total) : copy.selected(selected.length)}
          </span>
          {!allMatching && pageSelected && total > selected.length ? (
            <Button variant="link" size="sm" onClick={() => setAllMatching(true)}>
              {copy.selectAllMatching(total)}
            </Button>
          ) : null}
          <div className="flex items-center gap-2">
            <Input
              value={bulkHsn}
              inputMode="numeric"
              maxLength={8}
              placeholder={copy.hsnPlaceholder}
              aria-label={copy.bulk.hsn}
              className="w-32"
              onChange={(e) => setBulkHsn(e.target.value.replace(/\D/g, ''))}
            />
            <Button variant="outline" size="sm" disabled={busy} onClick={handleBulkHsn}>
              {copy.bulk.applyHsn}
            </Button>
          </div>
          <div className="w-44">
            <ChoiceField
              id="bulk-rate"
              label={copy.bulk.rate}
              hideLabel
              value={NONE}
              placeholder={copy.bulk.rate}
              options={rateOptions}
              onChange={handleBulkRate}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void save(target, { taxable: true })}
          >
            {copy.bulk.chargeOn}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void save(target, { taxable: false })}
          >
            {copy.bulk.chargeOff}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClear}>
            {copy.bulk.clear}
          </Button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={`${HEAD} w-10`}>
                <Checkbox
                  checked={pageSelected}
                  onCheckedChange={(on) => handleSelectPage(on === true)}
                  aria-label={copy.selectPage}
                />
              </TableHead>
              <TableHead className={HEAD}>{copy.columns.product}</TableHead>
              <TableHead className={HEAD}>{copy.columns.charge}</TableHead>
              <TableHead className={HEAD}>{copy.columns.rate}</TableHead>
              <TableHead className={HEAD}>{copy.columns.hsn}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data && items.length === 0 ? <TableEmptyRow colSpan={5} message={copy.empty} /> : null}
            {items.map((row) => (
              <ProductsTaxRow
                key={`${row.id}|${row.hsCode ?? ''}`}
                row={row}
                rateOptions={rateOptions}
                selected={allMatching || selected.includes(row.id)}
                busy={busy}
                onSelect={(on) => handleSelect(row.id, on)}
                onChange={(change) => void save({ ids: [row.id] }, change)}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {pages > 1 ? (
        <div className="flex items-center justify-end gap-3">
          <span className="text-caption text-muted-foreground">{copy.page(page, pages)}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            {copy.previous}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            {copy.next}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
