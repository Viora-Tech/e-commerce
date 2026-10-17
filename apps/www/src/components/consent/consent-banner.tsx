'use client'

import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { consentContent as copy } from '@/data/consent'

type ConsentBannerProps = {
  onPreferences: () => void
  onReject: () => void
  onAccept: () => void
}

export default function ConsentBanner({ onPreferences, onReject, onAccept }: ConsentBannerProps) {
  return (
    <section
      aria-label={copy.bannerTitle}
      className="print:hidden glass-popover fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-page flex-col gap-4 rounded-2xl p-4 md:inset-x-8 md:flex-row md:items-center md:justify-between md:p-5"
    >
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-foreground">{copy.bannerTitle}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {copy.bannerBody}{' '}
          <Link href="/cookies" className="text-foreground underline underline-offset-2">
            {copy.policyLink}
          </Link>
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:shrink-0 sm:flex-row">
        <Button variant="outline" size="lg" onClick={onPreferences}>
          {copy.preferences}
        </Button>
        <Button variant="outline" size="lg" onClick={onReject}>
          {copy.rejectNonEssential}
        </Button>
        <Button variant="secondary" size="lg" onClick={onAccept}>
          {copy.acceptAll}
        </Button>
      </div>
    </section>
  )
}
