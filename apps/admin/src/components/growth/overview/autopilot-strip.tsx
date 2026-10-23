'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import { growthHomeContent } from '@/data/growth-home'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type AutopilotStripProps = { enabled: boolean; waiting: number }

/** The overview's "Campaign Autopilot" strip: one line on where it stands and one button. */
export default function AutopilotStrip({ enabled, waiting }: AutopilotStripProps) {
  // Hooks
  const copy = useCopy(growthHomeContent.autopilotStrip)

  // Render logic
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-body-strong text-foreground">{copy.title}</h2>
      <Card inset={5} className="flex-row flex-wrap items-center justify-between gap-3">
        <p className="text-body text-muted-foreground">{enabled ? copy.on(waiting) : copy.off}</p>
        <Button
          variant="outline"
          render={<Link href={routes.growth.autopilot()} />}
          nativeButton={false}
        >
          {enabled ? copy.open : copy.getStarted}
        </Button>
      </Card>
    </section>
  )
}
