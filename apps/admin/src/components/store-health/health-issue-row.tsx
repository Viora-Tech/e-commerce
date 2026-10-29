import type { HealthIssue } from '@commerce/core/store-health'
import { ArrowRight } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { buttonVariants } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import StatusChip from '@/components/layout/status-chip'
import type { storeHealthContent } from '@/data/store-health'
import { healthLink, healthText, SEVERITY_TONE } from '@/lib/store-health'

type HealthIssueRowProps = {
  issue: HealthIssue
  /** Already in the member's language. */
  copy: typeof storeHealthContent
  /** Show the severity chip (the import summary mixes severities in one list). */
  showSeverity?: boolean
}

/** One problem: area and title, why it matters, and the button that opens where it is fixed. */
export default function HealthIssueRow({ issue, copy, showSeverity = false }: HealthIssueRowProps) {
  // Render logic
  const text = healthText(issue, copy)
  const link = healthLink(issue)

  return (
    <li className="flex flex-col gap-3 border-b border-hairline py-3.5 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          {showSeverity ? (
            <StatusChip tone={SEVERITY_TONE[issue.severity]}>
              {copy.severity[issue.severity]}
            </StatusChip>
          ) : null}
          <span className="text-caption text-muted-foreground">{copy.areas[issue.area]}</span>
        </div>
        <p className="text-body font-semibold break-words text-ink-strong">{text.title}</p>
        <p className="text-caption text-muted-foreground">{text.body}</p>
      </div>
      <Link
        href={link.href}
        {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className={cn(
          buttonVariants({ variant: 'outline', size: 'sm' }),
          'shrink-0 self-start sm:self-center',
        )}
      >
        {text.fix}
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </li>
  )
}
