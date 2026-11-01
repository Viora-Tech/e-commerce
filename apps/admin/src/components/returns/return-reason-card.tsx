import { returnReasonLabel } from '@commerce/core/returns'
import DataCard from '@/components/layout/data-card'
import KeyValueList from '@/components/layout/key-value-list'
import { returnDetailContent as copy, returnRulesContent, returnsContent } from '@/data/returns'
import type { ReturnDetail } from './return-types'

type ReturnReasonCardProps = { detail: ReturnDetail }

/** The customer's side: reason, note and photos. */
export default function ReturnReasonCard({ detail: r }: ReturnReasonCardProps) {
  // Render logic
  const reason = r.reason ? returnReasonLabel(r.reason, returnsContent.reasons) : null
  const rules = returnRulesContent
  const wants = r.preferredResolution ? (rules.wants[r.preferredResolution] ?? null) : null
  const swaps = r.exchangeWishes.map((w) =>
    rules.swapTo(
      [w.title, w.from && w.from !== 'Default' ? w.from : null].filter(Boolean).join(' / '),
      w.variantTitle,
    ),
  )

  return (
    <DataCard title={copy.why}>
      <div className="flex flex-col gap-3 text-body">
        <KeyValueList
          rows={[
            { label: copy.reasonLabel, value: reason },
            {
              label: copy.wantsLabel,
              hidden: !wants,
              value: (
                <span className="flex flex-col">
                  <span>{wants}</span>
                  {swaps.map((s) => (
                    <span key={s} className="text-muted-foreground">
                      {s}
                    </span>
                  ))}
                </span>
              ),
            },
            {
              label: copy.noteLabel,
              value: <span className="whitespace-pre-line">{r.customerNote || copy.noNote}</span>,
            },
            {
              label: copy.photos,
              hidden: r.photos.length === 0,
              value: (
                <span className="flex flex-wrap gap-2 pt-1">
                  {r.photos.map((url, i) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="block size-24 overflow-hidden rounded-lg border border-border bg-muted"
                    >
                      {/* biome-ignore lint/performance/noImgElement: customer upload on the store's storage. */}
                      <img
                        src={url}
                        alt={copy.photoAlt(i + 1)}
                        className="size-full object-cover"
                      />
                    </a>
                  ))}
                </span>
              ),
            },
          ]}
        />
        {r.autoApproved ? (
          <p className="text-caption text-muted-foreground">{rules.autoApproved}</p>
        ) : null}
        {r.status === 'rejected' && r.decisionNote ? (
          <p className="rounded-lg bg-danger-soft px-3 py-2 text-danger">
            {copy.decision.declinedBecause(r.decisionNote)}
          </p>
        ) : null}
      </div>
    </DataCard>
  )
}
