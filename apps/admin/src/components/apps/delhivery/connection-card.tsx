'use client'

import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { delhiveryAppContent } from '@/data/delhivery'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type ConnectionCardProps = {
  /** The saved Delhivery fields (secrets come back masked, `••••7f2a`); null when unreadable. */
  saved: Record<string, string> | null
  /** "Test connection" passed on the Connect page (the cosmetic flag ProviderConnectPage sets). */
  tested: boolean
}

/** Figma 928:11256 "Connection": account, API key, tracking updates and pickup name, with Edit. */
export default function ConnectionCard({ saved, tested }: ConnectionCardProps) {
  // Hooks
  const { overview } = useCopy(delhiveryAppContent)

  // Render logic
  const copy = overview.connection
  const key = saved?.apiToken?.trim() ?? ''
  const rows = [
    { label: copy.account, value: saved?.clientName?.trim() || copy.unknown },
    {
      label: copy.apiKey,
      value: key ? `${key} · ${tested ? copy.works : copy.saved}` : copy.unknown,
    },
    {
      label: copy.tracking,
      value: saved?.webhookSecret?.trim() ? copy.webhookOn : copy.polled,
    },
    { label: copy.pickupName, value: saved?.pickupLocationName?.trim() || copy.unknown },
  ]

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border surface-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-body font-semibold text-ink-strong">{copy.title}</h2>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href={routes.apps.connect('delhivery')} />}
        >
          {copy.edit}
        </Button>
      </div>
      <dl className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-caption text-muted-foreground">{r.label}</dt>
            <dd className="min-w-0 truncate text-right text-caption text-foreground">{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
