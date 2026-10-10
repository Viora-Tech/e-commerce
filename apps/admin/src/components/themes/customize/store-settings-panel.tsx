'use client'

import { ChevronRight, ExternalLink } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { CHROME_FOCUS, CHROME_TRANSITION } from '@/lib/customize-chrome'
import { routes } from '@/lib/routes'

type StoreSettingsPanelProps = {
  /** Opens the Theme settings panel (colours, type, layout). */
  onOpenTheme: () => void
}

type LinkKey = keyof (typeof customizeContent)['storeSettings']['links']
type Link = { key: LinkKey; href: string }

/** Store settings the theme shows, each opened in a new tab so the editor keeps its work. */
const LINKS: Link[] = [
  { key: 'seo', href: routes.onlineStore.preferences() },
  { key: 'menus', href: routes.content.menus() },
  { key: 'store', href: routes.settings.store() },
  { key: 'policies', href: routes.settings.policies() },
  { key: 'cookies', href: routes.settings.privacyBanner() },
  { key: 'checkout', href: routes.settings.checkout() },
  { key: 'domains', href: routes.settings.domains() },
]

const ROW = cn(
  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted/60',
  CHROME_TRANSITION,
  CHROME_FOCUS,
)

/**
 * The rail's Settings tab: everything a theme shows that is set outside it (the store's title and
 * sharing picture, menus, contact details, policies, cookie banner, checkout, domains), as links,
 * plus a way back to the theme's own colours and type.
 */
export default function StoreSettingsPanel({ onOpenTheme }: StoreSettingsPanelProps) {
  // Hooks
  const copy = useCopy(customizeContent.storeSettings)

  // Render logic
  return (
    <div className="flex flex-col gap-1 px-2 py-3">
      <button type="button" onClick={onOpenTheme} className={ROW}>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[0.8125rem] leading-5 font-medium text-foreground">
            {copy.theme.title}
          </span>
          <span className="text-xs text-muted-foreground">{copy.theme.hint}</span>
        </span>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </button>
      <p className="px-3 pt-3 pb-1 text-[0.6875rem] leading-4 font-medium text-muted-foreground">
        {copy.heading}
      </p>
      {LINKS.map((link) => (
        <a key={link.key} href={link.href} target="_blank" rel="noreferrer" className={ROW}>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[0.8125rem] leading-5 font-medium text-foreground">
              {copy.links[link.key].title}
            </span>
            <span className="text-xs text-muted-foreground">{copy.links[link.key].hint}</span>
          </span>
          <ExternalLink
            aria-label={copy.newTab}
            className="size-3.5 shrink-0 text-muted-foreground"
          />
        </a>
      ))}
    </div>
  )
}
