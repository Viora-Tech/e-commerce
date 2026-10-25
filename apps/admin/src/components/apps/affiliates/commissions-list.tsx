'use client'

import { siteConfig } from '@commerce/config/site'
import { Button } from '@commerce/ui/shadcn/button'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  type CommissionRow,
  commissionColumns,
} from '@/components/apps/affiliates/commission-columns'
import PageHeader from '@/components/layout/page-header'
import ResourceTable from '@/components/table/resource-table'
import { affiliatesContent } from '@/data/affiliates'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

/** The commissions ledger: every order an affiliate brought and where its commission stands. */
export default function CommissionsList() {
  // Hooks
  const copy = useCopy(affiliatesContent)
  const f = useFormat()
  const [rows, setRows] = useState<CommissionRow[] | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<number>(siteConfig.ui.rowsPerPage.default)
  const [reload, setReload] = useState(0)
  const [busy, setBusy] = useState(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reload` re-runs the load after a change
  useEffect(() => {
    let cancelled = false
    api.affiliates.commissions.list().then((r) => {
      if (!cancelled) setRows(r)
    })
    return () => {
      cancelled = true
    }
  }, [reload])

  // Event handlers
  const handleChanged = () => setReload((n) => n + 1)
  const handleQuery = (next: string) => {
    setQuery(next)
    setPage(1)
  }
  const handlePerPage = (next: number) => {
    setPerPage(next)
    setPage(1)
  }
  const handleApproveDue = async () => {
    setBusy(true)
    try {
      const r = await api.affiliates.commissions.approveDue()
      toast.success(copy.commissions.approvedDue(r.approved, r.reversed))
      handleChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const needle = query.trim().toLowerCase()
  const matching = (rows ?? []).filter(
    (r) =>
      !needle ||
      [String(r.orderNumber), r.affiliateName, r.affiliateCode].some((v) =>
        v.toLowerCase().includes(needle),
      ),
  )
  const visible = matching.slice((page - 1) * perPage, page * perPage)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={copy.commissions.title}
        summary={copy.commissions.subtitle}
        actions={
          <Button variant="outline" onClick={handleApproveDue} disabled={busy}>
            {copy.commissions.approveDue}
          </Button>
        }
      />
      <ResourceTable
        resourceName={copy.commissions.resource}
        columns={commissionColumns(copy, f, handleChanged, { withAffiliate: true })}
        items={visible}
        getId={(r) => r.id}
        href={(r) => routes.orders.detail(r.orderId)}
        selectable={false}
        loading={rows === null}
        query={query}
        onQueryChange={handleQuery}
        page={page}
        perPage={perPage}
        total={matching.length}
        onPageChange={setPage}
        onPerPageChange={handlePerPage}
        empty={{ heading: copy.commissions.empty }}
      />
    </div>
  )
}
