import type { ReturnReason } from '@commerce/core/returns'
import DataCard from '@/components/layout/data-card'
import { returnDetailContent as copy, returnsContent } from '@/data/returns'
import type { ReturnDetail } from './return-types'

type ReturnReasonCardProps = { detail: ReturnDetail }

/** The customer's side: reason, note and photos. */
export default function ReturnReasonCard({ detail: r }: ReturnReasonCardProps) {
  // Render logic
  const reason = r.reason ? (returnsContent.reasons[r.reason as ReturnReason] ?? r.reason) : null

  return (
    <DataCard title={copy.why}>
      <dl className="flex flex-col gap-3 text-body">
        <div className="flex flex-col gap-0.5">
          <dt className="text-caption text-muted-foreground">{copy.reasonLabel}</dt>
          <dd className="text-foreground">{reason}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-caption text-muted-foreground">{copy.noteLabel}</dt>
          <dd className="whitespace-pre-line text-foreground">{r.customerNote || copy.noNote}</dd>
        </div>
        {r.photos.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <dt className="text-caption text-muted-foreground">{copy.photos}</dt>
            <dd className="flex flex-wrap gap-2">
              {r.photos.map((url, i) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="block size-24 overflow-hidden rounded-lg border border-border bg-muted"
                >
                  {/* biome-ignore lint/performance/noImgElement: customer upload on the store's storage. */}
                  <img src={url} alt={copy.photoAlt(i + 1)} className="size-full object-cover" />
                </a>
              ))}
            </dd>
          </div>
        ) : null}
        {r.status === 'rejected' && r.decisionNote ? (
          <p className="rounded-lg bg-danger-soft px-3 py-2 text-danger">
            {copy.decision.declinedBecause(r.decisionNote)}
          </p>
        ) : null}
      </dl>
    </DataCard>
  )
}
