import { CheckIcon as Check } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { affiliateContent } from '@/data/affiliate'
import type { AffiliatePortal } from '@/lib/affiliates'
import { day } from '@/lib/portal-format'

type ApplicationStatusProps = { affiliate: NonNullable<AffiliatePortal['affiliate']> }

const copy = affiliateContent

/** Where their application stands: in review (with the steps), declined (with why) or paused. */
export default function ApplicationStatus({ affiliate: a }: ApplicationStatusProps) {
  // Early returns
  if (a.status === 'rejected' || a.status === 'suspended') {
    const s = copy[a.status]
    return (
      <Alert tone={a.status === 'rejected' ? 'danger' : 'warning'}>
        <AlertTitle>{s.title}</AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          <span>{s.body}</span>
          {a.status === 'rejected' && a.rejectReason ? (
            <span className="border-l-2 pl-3 whitespace-pre-line">
              <span className="block text-xs">{copy.rejected.reason}</span>
              {a.rejectReason}
            </span>
          ) : null}
        </AlertDescription>
      </Alert>
    )
  }

  // Render logic
  const p = copy.pending
  const steps = [
    { label: p.steps.applied(day(a.appliedAt)), done: true },
    { label: p.steps.review, done: false },
    { label: p.steps.approved, done: false },
  ]
  return (
    <div className="flex flex-col gap-4" role="status">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{p.title}</h2>
        <p className="text-sm text-muted-foreground">{p.body}</p>
      </div>
      <ol className="flex flex-col gap-3">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-center gap-3 text-sm">
            <span
              aria-hidden
              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                s.done ? 'bg-success text-success-foreground' : 'border text-muted-foreground'
              }`}
            >
              {s.done ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={s.done ? '' : 'text-muted-foreground'}>{s.label}</span>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted-foreground">{a.payoutHint ? p.payout : p.noPayout}</p>
    </div>
  )
}
