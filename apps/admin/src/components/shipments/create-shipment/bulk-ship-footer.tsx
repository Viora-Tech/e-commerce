'use client'

import { Truck } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { bulkShipContent } from '@/data/bulk-ship'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'
import type { BulkSummary } from './bulk-ship-state'

type Wallets = Awaited<ReturnType<typeof api.shipments.wallets>>

type BulkShipFooterProps = {
  summary: BulkSummary
  insured: boolean
  wallets: Wallets
  busy: boolean
  onCancel: () => void
  onBook: () => void
}

/** The bulk drawer's footer (Figma 908:8804): Ready, Need attention, Total, Wallets, Book. */
export default function BulkShipFooter({
  summary,
  insured,
  wallets,
  busy,
  onCancel,
  onBook,
}: BulkShipFooterProps) {
  // Hooks
  const copy = useCopy(bulkShipContent)
  const fmt = useFormat()

  // Render logic
  const f = copy.footer
  const known = wallets.filter((w) => w.supportsLiveBalance || w.fetchedAt)
  const short = known.filter((w) => (summary.byProvider[w.provider] ?? 0) > w.balancePaise)
  const total = `${f.totalValue(fmt.money(summary.totalPaise), insured)}${summary.unpriced > 0 ? f.unpriced(summary.unpriced) : ''}`

  return (
    <div className="flex flex-col gap-4 border-t border-hairline px-4 py-4 md:flex-row md:items-center md:justify-between md:px-8">
      <dl className="flex flex-wrap gap-x-8 gap-y-3 text-body">
        <Stat label={f.ready} value={f.readyValue(summary.ready, summary.total)} />
        {summary.attention > 0 ? (
          <Stat label={f.attention} value={f.attentionValue(summary.attention)} />
        ) : null}
        <Stat label={f.total} value={total} />
        {known.length > 0 ? (
          <Stat
            label={f.wallets}
            value={known.map((w) => `${w.providerLabel} ${fmt.money(w.balancePaise)}`).join(' · ')}
            note={
              short.length > 0 ? short.map((w) => f.walletLow(w.providerLabel)).join('. ') : null
            }
          />
        ) : null}
      </dl>
      <div className="flex shrink-0 items-center justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          {copy.cancel}
        </Button>
        <Button onClick={onBook} disabled={busy || summary.ready === 0} loading={busy}>
          {busy ? null : <Truck aria-hidden="true" />}
          {busy ? copy.booking : copy.book(summary.ready)}
        </Button>
      </div>
    </div>
  )
}

function Stat({ label, value, note }: { label: string; value: string; note?: string | null }) {
  return (
    <div className="flex flex-col">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="font-medium text-ink-strong tabular-nums">{value}</dd>
      {note ? <dd className="text-caption text-warning">{note}</dd> : null}
    </div>
  )
}
