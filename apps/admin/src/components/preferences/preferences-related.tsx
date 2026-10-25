import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import SettingsCard from '@/components/settings/settings-card'
import { preferencesContent } from '@/data/preferences'
import { routes } from '@/lib/routes'

const copy = preferencesContent.related

/** Storefront settings Shopify keeps near Preferences that live on their own pages here. */
const ROWS = [
  { key: 'favicon', href: routes.onlineStore.themes(), ...copy.favicon },
  { key: 'redirects', href: routes.content.redirects(), ...copy.redirects },
  { key: 'domains', href: routes.settings.domains(), ...copy.domains },
] as const

/** Links out to the favicon, URL redirects and domains instead of repeating them here. */
export default function PreferencesRelated() {
  // Render logic
  return (
    <SettingsCard title={copy.heading} description={copy.body}>
      {ROWS.map((row) => (
        <div
          key={row.key}
          className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-hairline py-4 first:pt-0 last:border-b-0 last:pb-0"
        >
          <div className="flex min-w-0 flex-1 basis-60 flex-col gap-0.5">
            <p className="text-body font-semibold text-ink-strong">{row.title}</p>
            <p className="text-caption text-muted-foreground">{row.body}</p>
          </div>
          <Button
            variant="outline"
            className="ml-auto"
            render={<Link href={row.href} />}
            nativeButton={false}
          >
            {row.link}
          </Button>
        </div>
      ))}
    </SettingsCard>
  )
}
