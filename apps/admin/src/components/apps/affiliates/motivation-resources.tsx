'use client'

import { BadgePercent, Images } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import SectionHead from '@/components/layout/section-head'
import { affiliatesLayoutContent } from '@/data/affiliates-layout'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type MotivationResourcesProps = {
  /** Opens the media picker for a new creative. */
  onAddMedia: () => void
}

const TILE = 'flex size-12 shrink-0 items-center justify-center rounded-full bg-info-soft text-info'

/**
 * Motivation › Promotional resources (UpPromote's two cards): Coupons, which are the affiliates'
 * own discount codes in Discounts, and the Media gallery of creatives below.
 */
export default function MotivationResources({ onAddMedia }: MotivationResourcesProps) {
  // Hooks
  const { motivation: copy } = useCopy(affiliatesLayoutContent)

  // Render logic
  return (
    <section className="flex flex-col gap-4">
      <SectionHead title={copy.resources} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-start gap-4 rounded-lg surface-card p-4">
          <span className={TILE} aria-hidden>
            <BadgePercent className="size-6" />
          </span>
          <div className="flex min-w-0 flex-col items-start gap-2">
            <p className="text-body font-medium">{copy.coupons}</p>
            <p className="text-caption text-muted-foreground">{copy.couponsBody}</p>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={routes.discounts.list()} />}
            >
              {copy.manageCoupons}
            </Button>
          </div>
        </div>
        <div className="flex items-start gap-4 rounded-lg surface-card p-4">
          <span className={TILE} aria-hidden>
            <Images className="size-6" />
          </span>
          <div className="flex min-w-0 flex-col items-start gap-2">
            <p className="text-body font-medium">{copy.media}</p>
            <p className="text-caption text-muted-foreground">{copy.mediaBody}</p>
            <Button variant="outline" size="sm" onClick={onAddMedia}>
              {copy.addMedia}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
