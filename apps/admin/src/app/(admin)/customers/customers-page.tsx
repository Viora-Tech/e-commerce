'use client'

import { CONSENT_CHANNELS, type ConsentChannel } from '@commerce/core/privacy'
import { ChevronDown, Download, Pencil, Users } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Fragment, Suspense, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { type CustomerRow, customerColumns } from '@/components/customers/customer-columns'
import CustomerRowActions from '@/components/customers/customer-row-actions'
import CustomerTiles, { type CustomerStats } from '@/components/customers/customer-tiles'
import TagCustomersDialog from '@/components/customers/tag-customers-dialog'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import PageState from '@/components/states/page-state'
import {
  appliedFromGroups,
  clearGroups,
  FILTER_PANEL_CLASS,
  FilterPanel,
} from '@/components/table/filter-panel'
import ResourceTable from '@/components/table/resource-table'
import ViewSelect from '@/components/table/view-select'
import { CHANNEL_LABEL } from '@/data/customer-privacy'
import { CUSTOMER_SEGMENTS, type CustomerSegment, customersContent } from '@/data/customers'
import { CUSTOMERS_BULK_EDIT_IDS_KEY } from '@/data/customers-bulk-edit'
import { filterPanelContent } from '@/data/filter-panel'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { downloadCsv, toCsv } from '@/lib/csv'
import { type ListQuery, sameListQuery } from '@/lib/list-query'
import { formatPaise } from '@/lib/money'
import { routes } from '@/lib/routes'
import {
  type CustomerFilterState,
  customerFilterGroups,
  customerFilterInput,
  EMPTY_CUSTOMER_FILTERS,
  hasCustomerFilters,
  segmentRulesFromFilters,
} from './customer-filter-state'

type ListResult = Awaited<ReturnType<typeof api.customers.list>>

/** A bulk marketing consent change waiting for the merchant to confirm it. */
type ConsentChange = { ids: string[]; channel: ConsentChannel; granted: boolean }

/** First page, stat cards and the all-customers count from the server so nothing paints empty. */
export type CustomersInitial = {
  query: ListQuery<CustomerSegment>
  perPage: number
  result: ListResult
  stats: CustomerStats
  allCount: number
  tags: string[]
}

function exportRows(rows: CustomerRow[], exported: (n: number) => string): void {
  const csv = toCsv(
    ['Name', 'Email', 'Phone', 'City', 'State', 'Orders', 'Spent', 'Tags', 'Marketing'],
    rows.map((r) => [
      r.name ?? '',
      r.email ?? '',
      r.phone ?? '',
      r.city ?? '',
      r.stateCode ?? '',
      r.orderCount,
      formatPaise(r.spentPaise),
      r.tags.join(' '),
      r.acceptsMarketing ? 'yes' : 'no',
    ]),
  )
  downloadCsv(`customers-${new Date().toISOString().slice(0, 10)}.csv`, csv)
  toast.success(exported(rows.length))
}

/** One mailto with the selected customers in Bcc, so the addresses stay private from each other. */
function bulkMailto(rows: CustomerRow[]): string | null {
  const emails = rows.flatMap((r) => (r.email ? [r.email] : []))
  return emails.length > 0 ? `mailto:?bcc=${encodeURIComponent(emails.join(','))}` : null
}

function CustomersContent({ initial }: { initial: CustomersInitial }) {
  // Hooks
  const copy = useCopy(customersContent)
  const panelCopy = useCopy(filterPanelContent)
  const router = useRouter()
  const [{ page, perPage, query, status }, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      perPage: parseAsInteger.withDefault(initial.perPage),
      status: parseAsStringLiteral(CUSTOMER_SEGMENTS),
    },
    { shallow: true },
  )
  const [filters, setFilters] = useState<CustomerFilterState>(EMPTY_CUSTOMER_FILTERS)
  const [items, setItems] = useState<CustomerRow[]>(initial.result.items)
  const [total, setTotal] = useState(initial.result.total)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [tagAction, setTagAction] = useState<'add' | 'remove' | null>(null)
  const [tagIds, setTagIds] = useState<string[]>([])
  const [consentChange, setConsentChange] = useState<ConsentChange | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  /** Channels the store can send on; the Marketing menu offers only these. */
  const [sendable, setSendable] = useState<readonly ConsentChannel[]>(['email'])

  useEffect(() => {
    api.customerPrivacy
      .sendableChannels()
      .then(setSendable)
      .catch(() => {})
  }, [])
  const hydrated = useRef(false)

  useEffect(() => {
    const untouched =
      sameListQuery({ page, query, status }, initial.query) &&
      perPage === initial.perPage &&
      !hasCustomerFilters(filters) &&
      reloadKey === 0
    // The server's first page is used once; after any change (including back to the first
    // tab) the list is fetched again, so it never keeps another tab's rows.
    const firstRun = !hydrated.current
    hydrated.current = true
    if (firstRun && untouched) return
    let cancelled = false
    setLoading(true)
    setFailed(false)
    api.customers
      .list({
        page,
        perPage,
        search: query || undefined,
        segment: status ?? undefined,
        ...customerFilterInput(filters),
      })
      .then((r) => {
        if (cancelled) return
        setItems(r.items)
        setTotal(r.total)
      })
      .catch(() => !cancelled && setFailed(true))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [page, perPage, query, status, filters, initial.query, initial.perPage, reloadKey])

  // Helpers
  const patchFilters = (patch: Partial<CustomerFilterState>) => {
    setFilters((f) => ({ ...f, ...patch }))
    setQ({ page: 1 })
  }

  // Event handlers
  const handleClearAll = () => {
    setFilters(EMPTY_CUSTOMER_FILTERS)
    setQ({ query: '', status: null, page: 1 })
  }

  const handleExportAll = async () => {
    try {
      const rows = await api.customers.export({
        search: query || undefined,
        segment: status ?? undefined,
        ...customerFilterInput(filters),
      })
      exportRows(rows, copy.exported)
    } catch {
      toast.error(copy.exportFailed)
    }
  }

  /* Thousands of ids don't fit in a URL: hand them to the sheet through sessionStorage. */
  const handleBulkEdit = (ids: string[]) => {
    try {
      sessionStorage.setItem(CUSTOMERS_BULK_EDIT_IDS_KEY, JSON.stringify(ids))
    } catch {
      toast.error(copy.bulk.openFailed)
      return
    }
    router.push(routes.customers.bulkEdit())
  }

  const handleBulkTag = (ids: string[], action: 'add' | 'remove') => {
    setTagIds(ids)
    setTagAction(action)
  }

  const handleReload = () => setReloadKey((k) => k + 1)

  const handleConfirmConsent = async () => {
    if (!consentChange) return
    try {
      const { updated } = await api.customerPrivacy.setConsentMany(consentChange)
      toast.success(updated === 0 ? copy.bulk.noChange : copy.bulk.tagged(updated))
      handleReload()
    } catch (err) {
      toast.error(copy.bulk.consentFailed)
      throw err
    }
  }

  // Render logic
  const columns = customerColumns(copy)
  const groups = customerFilterGroups(filters, initial.tags, patchFilters)
  const applied = appliedFromGroups(groups, panelCopy)
  const filtered = applied.length > 0 || query.length > 0
  const segmentHref = `${routes.customers.newSegment()}?rules=${encodeURIComponent(
    JSON.stringify(segmentRulesFromFilters(filters, status)),
  )}`
  const summary =
    initial.stats.total === 0
      ? copy.summary.empty
      : [
          copy.summary.total(initial.stats.total),
          copy.summary.newThisWeek(initial.stats.newLast7),
          copy.summary.repeat(initial.stats.returning),
        ].join(' · ')

  return (
    <PageBody width="frame" className="gap-6">
      <PageHeader
        title={copy.heading}
        summary={summary}
        actions={
          <>
            {applied.length > 0 ? (
              <Button variant="outline" render={<Link href={segmentHref} />} nativeButton={false}>
                {copy.saveSegment}
              </Button>
            ) : null}
            <Button variant="outline" onClick={handleExportAll}>
              <Download strokeWidth={1.6} />
              {copy.exportAll}
            </Button>
            <Button render={<Link href={routes.customers.segments()} />} nativeButton={false}>
              <Users strokeWidth={1.6} />
              {copy.segmentsLink}
            </Button>
          </>
        }
      />
      <CustomerTiles
        stats={initial.stats}
        active={status}
        onSelect={(s) => setQ({ status: s, page: 1 })}
      />
      {failed ? (
        <PageState
          kind="error"
          heading={copy.loadFailed.heading}
          body={copy.loadFailed.body}
          onRetry={handleReload}
        />
      ) : (
        <ResourceTable
          resourceName={copy.resource}
          columns={columns}
          items={items}
          getId={(c) => c.id}
          href={(c) => routes.customers.detail(c.id)}
          rowActions={(c) => (
            <CustomerRowActions
              id={c.id}
              name={c.name ?? c.email ?? copy.unnamed}
              email={c.email}
              phone={c.phone}
              onDeleted={handleReload}
            />
          )}
          loading={loading}
          query={query}
          onQueryChange={(q) => setQ({ query: q, page: 1 })}
          onClearAll={handleClearAll}
          filters={(close) => (
            <FilterPanel
              groups={groups}
              onClear={() => clearGroups(groups)}
              footer={{ label: panelCopy.show(total), onDone: close }}
            />
          )}
          filtersClassName={FILTER_PANEL_CLASS}
          applied={applied}
          views={
            <ViewSelect
              value={status}
              onChange={(s) => setQ({ status: s, page: 1 })}
              options={[
                { value: null, label: copy.tabs.all, count: initial.allCount },
                ...CUSTOMER_SEGMENTS.map((s) => ({ value: s, label: copy.tabs[s] })),
              ]}
            />
          }
          page={page}
          perPage={perPage}
          total={total}
          onPageChange={(p) => setQ({ page: p })}
          onPerPageChange={(n) => setQ({ perPage: n, page: 1 })}
          bulkActions={(ids, clear) => {
            const mail = bulkMailto(items.filter((i) => ids.includes(i.id)))
            return (
              <>
                <Button variant="outline" size="sm" onClick={() => handleBulkEdit(ids)}>
                  <Pencil />
                  {copy.bulk.bulkEdit}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
                    {copy.bulk.addTag}
                    <ChevronDown />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => handleBulkTag(ids, 'add')}>
                      {copy.bulk.addTag}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkTag(ids, 'remove')}>
                      {copy.bulk.removeTag}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
                    {copy.bulk.marketing}
                    <ChevronDown />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {CONSENT_CHANNELS.filter((c) => sendable.includes(c)).map((channel, i) => (
                      <Fragment key={channel}>
                        {i > 0 ? <DropdownMenuSeparator /> : null}
                        <DropdownMenuItem
                          onClick={() => setConsentChange({ ids, channel, granted: true })}
                        >
                          {copy.bulk.subscribe(CHANNEL_LABEL[channel])}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setConsentChange({ ids, channel, granted: false })}
                        >
                          {copy.bulk.unsubscribe(CHANNEL_LABEL[channel])}
                        </DropdownMenuItem>
                      </Fragment>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    exportRows(
                      items.filter((i) => ids.includes(i.id)),
                      copy.exported,
                    )
                    clear()
                  }}
                >
                  {copy.bulk.export}
                </Button>
                {mail ? (
                  <Button
                    variant="outline"
                    size="sm"
                    render={<a href={mail} />}
                    nativeButton={false}
                  >
                    {copy.bulk.email}
                  </Button>
                ) : null}
              </>
            )
          }}
          empty={filtered ? copy.noResults : copy.empty}
        />
      )}
      <TagCustomersDialog
        ids={tagIds}
        action={tagAction}
        onClose={() => setTagAction(null)}
        onDone={handleReload}
      />
      <ConfirmDialog
        open={consentChange !== null}
        onOpenChange={(open) => !open && setConsentChange(null)}
        title={
          consentChange
            ? copy.bulk.consentTitle(
                consentChange.granted,
                CHANNEL_LABEL[consentChange.channel],
                consentChange.ids.length,
              )
            : ''
        }
        body={consentChange ? copy.bulk.consentBody(consentChange.granted) : undefined}
        confirmLabel={copy.bulk.consentConfirm(consentChange?.granted ?? true)}
        tone={consentChange?.granted === false ? 'destructive' : 'default'}
        onConfirm={handleConfirmConsent}
      />
    </PageBody>
  )
}

export default function CustomersPage({ initial }: { initial: CustomersInitial }) {
  return (
    <Suspense>
      <CustomersContent initial={initial} />
    </Suspense>
  )
}
