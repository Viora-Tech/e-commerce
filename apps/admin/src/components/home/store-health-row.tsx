import type { StoreHealthReport } from '@commerce/core/store-health'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { homeSectionsContent } from '@/data/home-sections'
import { storeHealthContent } from '@/data/store-health'
import { getCopy } from '@/lib/copy-server'
import { routes } from '@/lib/routes'
import { healthText } from '@/lib/store-health'
import HomeSlimRow from './home-slim-row'

type StoreHealthRowProps = {
  report: StoreHealthReport
}

/**
 * Home's Store health as one slim row under the Needs you tiles: a dot (red when something
 * blocks checkout, amber otherwise), "Store health · 2 to fix", the worst problem in plain
 * words and "See what to fix" (Settings → Store health). A quiet green line when all is well.
 */
export default async function StoreHealthRow({ report }: StoreHealthRowProps) {
  // Early returns
  const copy = await getCopy(storeHealthContent)
  const s = (await getCopy(homeSectionsContent)).health
  const worst = report.issues[0]
  const total = report.issues.length
  if (!worst) {
    return <HomeSlimRow tone="success" lead={copy.card.title} text={copy.card.allGood} />
  }

  // Render logic
  return (
    <HomeSlimRow
      tone={report.counts.blocks_checkout > 0 ? 'danger' : 'attention'}
      lead={`${copy.card.title} · ${s.toFix(total)}`}
      text={healthText(worst, copy).title}
      action={
        <Button
          variant={report.counts.blocks_checkout > 0 ? 'default' : 'outline'}
          size="sm"
          nativeButton={false}
          render={<Link href={routes.settings.storeHealth()} />}
        >
          {copy.card.open}
        </Button>
      }
    />
  )
}
