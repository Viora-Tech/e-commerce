'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import { AUTOPILOT_DOCS_URL, growthHomeContent } from '@/data/growth-home'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import AutopilotIllustration from './autopilot-illustration'

type AutopilotHeroProps = {
  enabled: boolean
  /** Proposals waiting for approval. */
  waiting: number
}

/** The overview's top banner (Shopify's Campaign Autopilot hero): what it does, start or review. */
export default function AutopilotHero({ enabled, waiting }: AutopilotHeroProps) {
  // Hooks
  const copy = useCopy(growthHomeContent.hero)

  // Render logic
  const body = !enabled ? copy.body : waiting > 0 ? copy.waiting(waiting) : copy.on

  return (
    <Card inset={6} className="flex-row flex-wrap items-center justify-between gap-6">
      <div className="flex max-w-xl flex-col gap-3">
        <p className="text-card-title text-foreground">{copy.title}</p>
        <p className="text-body text-muted-foreground">{body}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button render={<Link href={routes.growth.autopilot()} />} nativeButton={false}>
            {enabled ? copy.review : copy.getStarted}
          </Button>
          <Button
            variant="outline"
            render={<a href={AUTOPILOT_DOCS_URL} target="_blank" rel="noreferrer" />}
            nativeButton={false}
          >
            {copy.learnMore}
          </Button>
        </div>
      </div>
      <AutopilotIllustration label={copy.illustration} />
    </Card>
  )
}
