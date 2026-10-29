import { HEALTH_SEVERITIES, type StoreHealthReport } from '@commerce/core/store-health'
import { ArrowRight } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { buttonVariants } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import StatusChip from '@/components/layout/status-chip'
import { storeHealthContent } from '@/data/store-health'
import { getCopy } from '@/lib/copy-server'
import { routes } from '@/lib/routes'
import { healthText, SEVERITY_TONE } from '@/lib/store-health'

type StoreHealthCardProps = {
  report: StoreHealthReport
}

/**
 * Home's "Store health": how many problems block checkout, should be fixed or are nice to have,
 * the worst one spelled out, and a link to Settings → Store health. Quiet when nothing is wrong.
 */
export default async function StoreHealthCard({ report }: StoreHealthCardProps) {
  // Render logic
  const copy = await getCopy(storeHealthContent)
  const worst = report.issues[0]
  const severities = HEALTH_SEVERITIES.filter((s) => report.counts[s] > 0)

  return (
    <section className="flex flex-col gap-3 rounded-lg p-4 surface-card sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h2 className="text-body font-semibold text-ink-strong">{copy.card.title}</h2>
        {worst ? (
          <>
            <ul className="flex flex-wrap gap-2">
              {severities.map((s) => (
                <li key={s}>
                  <StatusChip tone={SEVERITY_TONE[s]}>
                    {report.counts[s]} · {copy.severity[s]}
                  </StatusChip>
                </li>
              ))}
            </ul>
            <p className="truncate text-caption text-muted-foreground">
              {healthText(worst, copy).title}
            </p>
          </>
        ) : (
          <p className="text-caption text-muted-foreground">{copy.card.allGood}</p>
        )}
      </div>
      {worst ? (
        <Link
          href={routes.settings.storeHealth()}
          className={cn(
            buttonVariants({
              variant: report.counts.blocks_checkout ? 'default' : 'outline',
              size: 'sm',
            }),
            'shrink-0 self-start sm:self-center',
          )}
        >
          {copy.card.open}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      ) : null}
    </section>
  )
}
