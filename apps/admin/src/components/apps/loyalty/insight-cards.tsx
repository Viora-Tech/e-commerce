'use client'

import { ChevronRight } from '@commerce/ui/icons'
import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import { loyaltyInsightsContent } from '@/data/loyalty-insights'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

/** The pages these cards lead to, in the order they show. */
const PAGES = ['members', 'analytics', 'campaigns', 'emails'] as const

/** The overview's links to Members, Analytics, Campaigns and Emails, each with a line on what it holds. */
export default function LoyaltyInsightCards() {
  // Hooks
  const copy = useCopy(loyaltyInsightsContent)

  // Render logic
  const c = copy.cards
  const words = {
    members: { title: c.members, body: c.membersBody },
    analytics: { title: c.analytics, body: c.analyticsBody },
    campaigns: { title: c.campaigns, body: c.campaignsBody },
    emails: { title: c.emails, body: c.emailsBody },
  }

  return (
    <DataCard title={c.title} flush>
      <ul className="grid divide-y divide-border sm:grid-cols-2 sm:divide-y-0">
        {PAGES.map((page) => (
          <li key={page} className="sm:border-b sm:border-border sm:odd:border-r">
            <Link
              href={routes.apps.page('loyalty', page)}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-body font-medium">{words[page].title}</span>
                <span className="text-caption text-muted-foreground">{words[page].body}</span>
              </span>
              <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </DataCard>
  )
}
