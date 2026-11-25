'use client'

import type { CommissionRule } from '@commerce/plugin-affiliates/settings'
import { SocialMedia } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { rateText } from '@/components/apps/affiliates/rule-label'
import CopyButton from '@/components/fields/copy-button'
import DataCard from '@/components/layout/data-card'
import { affiliatesLayoutContent } from '@/data/affiliates-layout'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type DefaultProgramCardProps = {
  programId: string
  commission: CommissionRule
  /** The full signup link: the store's address and `/affiliate`. */
  link: string
}

/** Home › Default affiliate program: the rate, the registration link to copy or share, and where affiliates sign in. */
export default function DefaultProgramCard({
  programId,
  commission,
  link,
}: DefaultProgramCardProps) {
  // Hooks
  const { home } = useCopy(affiliatesLayoutContent)
  const f = useFormat()

  // Event handlers
  const handleShare = async () => {
    const c = home.program
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: c.shareText, url: link })
      } catch {
        // The merchant closed the share sheet.
      }
      return
    }
    window.open(link, '_blank', 'noopener')
  }

  // Render logic
  const c = home.program

  return (
    <DataCard
      title={c.title}
      subtitle={c.earn(rateText(commission, f.money))}
      footer={
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={routes.apps.page('affiliates', 'programs', programId)} />}
        >
          {c.editSignup}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col overflow-hidden rounded-lg border border-line sm:flex-row sm:items-center">
          <span className="shrink-0 border-line bg-muted px-3 py-2 text-body font-medium sm:border-r">
            {c.registration}
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-1 px-3 py-2">
            <span className="min-w-0 flex-1 truncate font-mono text-body">{link}</span>
            <CopyButton value={link} what={c.registration} visible />
            <button
              type="button"
              onClick={handleShare}
              aria-label={c.share}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <SocialMedia className="size-4" />
            </button>
          </span>
        </div>
        <div className="rounded-lg bg-muted px-3 py-2">
          <p className="text-body font-medium">{c.tips}</p>
          <p className="text-caption text-muted-foreground">{c.tipsBody}</p>
        </div>
      </div>
    </DataCard>
  )
}
