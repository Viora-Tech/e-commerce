'use client'

import { FacebookLogo, GoogleLogo } from '@commerce/ui/icons'
import DataCard from '@/components/layout/data-card'
import StatusChip from '@/components/layout/status-chip'
import { growthAutopilotContent } from '@/data/growth-home'
import { useCopy } from '@/hooks/use-copy'

/** Meta and Google ads for Autopilot: listed, not connectable yet (their apps are on the way). */
export default function AdChannelsCard() {
  // Hooks
  const copy = useCopy(growthAutopilotContent.ads)

  // Render logic
  const rows = [
    { id: 'meta', icon: FacebookLogo, name: copy.meta, soon: copy.soon.meta },
    { id: 'google', icon: GoogleLogo, name: copy.google, soon: copy.soon.google },
  ]

  return (
    <DataCard title={copy.title} subtitle={copy.subtitle}>
      <ul className="flex flex-col divide-y divide-border">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <span className="flex items-center gap-2 text-body-strong text-foreground">
              <r.icon aria-hidden className="size-4" />
              {r.name}
            </span>
            <StatusChip>{r.soon}</StatusChip>
          </li>
        ))}
      </ul>
    </DataCard>
  )
}
