import { formatInZone } from '@commerce/dates'
import { affiliateContent } from '@/data/affiliate'
import type { AffiliatePortal } from '@/lib/affiliates'

type AffiliateStatusProps = { affiliate: NonNullable<AffiliatePortal['affiliate']> }

const copy = affiliateContent

/**
 * Where an application stands: waiting for review (with what happens next), declined (with the
 * store's reason when it gave one) or paused.
 */
export default function AffiliateStatus({ affiliate: a }: AffiliateStatusProps) {
  // Early returns
  if (a.status === 'rejected' || a.status === 'suspended') {
    const s = copy[a.status]
    return (
      <div
        className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-6"
        role="status"
      >
        <h2 className="h3">{s.title}</h2>
        <p className="text-body text-muted">{s.body}</p>
        {a.status === 'rejected' && a.rejectReason ? (
          <div className="flex flex-col gap-1 border-l-2 border-line pl-3">
            <span className="text-small text-muted">{copy.rejected.reason}</span>
            <p className="text-body whitespace-pre-line">{a.rejectReason}</p>
          </div>
        ) : null}
      </div>
    )
  }

  // Render logic
  const p = copy.pending
  const steps = [
    { label: p.steps.applied(formatInZone(a.appliedAt, { dateStyle: 'medium' })), done: true },
    { label: p.steps.review, done: false },
    { label: p.steps.approved, done: false },
  ]

  return (
    <div className="flex flex-col gap-5 rounded-[var(--radius-card)] bg-surface p-6" role="status">
      <div className="flex flex-col gap-2">
        <h2 className="h3">{p.title}</h2>
        <p className="text-body text-muted">{p.body}</p>
      </div>
      <ol className="flex flex-col gap-3">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-center gap-3 text-body">
            <span
              aria-hidden
              className={`flex! size-6 shrink-0 items-center justify-center rounded-full text-[0.75rem] font-semibold ${
                s.done ? 'bg-success! text-bg!' : 'border border-line text-muted'
              }`}
            >
              {s.done ? '✓' : i + 1}
            </span>
            <span className={s.done ? '' : 'text-muted'}>{s.label}</span>
          </li>
        ))}
      </ol>
      <p className="text-small text-muted">{a.payoutHint ? p.payout : p.noPayout}</p>
    </div>
  )
}
