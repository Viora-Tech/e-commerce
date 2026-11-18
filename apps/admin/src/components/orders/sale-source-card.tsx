'use client'

import DataCard from '@/components/layout/data-card'
import KeyValueList from '@/components/layout/key-value-list'
import { saleSourceContent } from '@/data/sale-source'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { orderChannel } from '@/lib/order-channel'
import { type SaleAttribution, type SaleSourceRow, saleSourceRows } from '@/lib/sale-source'
import SalesChannelCard from './sales-channel-card'

/** Who made a staff draft (`orders.getDraft`'s `createdBy`, from the activity log). */
type DraftCreator = {
  name: string | null
  source: keyof typeof saleSourceContent.admin.sources
  at: Date | string
}

type SaleSourceCardProps = {
  /** The touch stored on the order or cart; null when the shopper's visit was not recorded. */
  attribution: SaleAttribution | null | undefined
  /** A draft staff made in the admin: says so (and who, when the log knows) instead. */
  staffDraft?: { createdBy: DraftCreator | null } | undefined
}

/**
 * "Where it came from", the same card on the order, draft and abandoned checkout pages. An
 * agent or social channel keeps its own card (Figma "Agentic sales · Order from an agent");
 * any other recorded touch lists the channel, referring site, UTM tags and first page; a staff
 * draft says it was created in the admin and by whom. Nothing recorded draws nothing.
 */
export default function SaleSourceCard({ attribution, staffDraft }: SaleSourceCardProps) {
  // Hooks
  const copy = useCopy(saleSourceContent)
  const fmt = useFormat()

  // Early returns
  const soldThrough = orderChannel(attribution)
  if (attribution && soldThrough) {
    return (
      <SalesChannelCard
        channel={soldThrough}
        cameFrom={attribution.referrer ?? attribution.source ?? null}
        campaign={attribution.campaign ?? null}
      />
    )
  }
  if (!attribution && !staffDraft) return null

  // Render logic
  const creator = staffDraft?.createdBy ?? null
  const rows: (SaleSourceRow & { hidden?: boolean })[] = attribution
    ? [
        ...saleSourceRows(attribution, copy),
        {
          key: 'visited',
          label: copy.visited,
          value: attribution.at ? fmt.when(attribution.at) : '',
          hidden: !attribution.at,
        },
      ]
    : [
        { key: 'channel', label: copy.channel, value: copy.admin.createdIn },
        { key: 'by', label: copy.admin.createdBy, value: creator?.name ?? copy.admin.someone },
        {
          key: 'via',
          label: copy.admin.via,
          value: creator ? copy.admin.sources[creator.source] : '',
          hidden: !creator || creator.source === 'admin',
        },
        {
          key: 'created',
          label: copy.admin.created,
          value: creator ? fmt.when(creator.at) : '',
          hidden: !creator,
        },
      ]

  return (
    <DataCard title={copy.title}>
      <KeyValueList
        variant="grid"
        rows={rows.map(({ key: _key, ...row }) => ({ ...row, truncate: true }))}
      />
    </DataCard>
  )
}
