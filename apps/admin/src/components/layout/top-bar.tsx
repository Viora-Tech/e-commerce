'use client'

import { AiIcon, ExternalLink, Search } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Kbd } from '@commerce/ui/shadcn/kbd'
import { SidebarTrigger } from '@commerce/ui/shadcn/sidebar'
import { navigationContent } from '@/data/navigation'
import { useCopy } from '@/hooks/use-copy'
import { modKey, openAssistant } from '@/lib/assistant-events'
import { openPalette } from '@/lib/palette-events'
import MemberAvatar from '../account/member-avatar'
import ActivityBell from './activity-bell'
import ThemeToggle from './theme-toggle'
import TopBarTip from './top-bar-tip'
import UserMenu from './user-menu'

type TopBarProps = {
  user: { name: string; email: string; image: string | null }
  /** Opens the live storefront in a new tab. */
  storefrontUrl: string
  /** Adds "Report a bug" to the account menu (test server only). */
  bugReports: boolean
  /** The active store's name, for the account menu's "Switch store" row. */
  storeName: string | null
  /** The page has scrolled (kept for callers; the bar stays flat so the panel's top corners show). */
  scrolled?: boolean
}

/* Figma top-bar "Icon button": 36px round, background fill, hairline and depth/button-outline,
   a 16px muted glyph; hover takes the muted fill (150 ms) and the full ink. */
const ICON_BUTTON =
  'flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-lift transition-colors duration-150 ease-out hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-muted aria-expanded:text-foreground active:scale-[0.96] motion-reduce:active:scale-100'

/** The host of a URL for the View store tooltip ("waimers.in"), or the URL itself when it will not parse. */
function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/**
 * The top bar (Figma "App / Top bar"): 56px on the shell colour, 4px in on the left and 8px on
 * the right, 8px gaps. Left: the sidebar toggle, the 320px search field (opens the command
 * palette, as does ⌘K) and "Ask AI" (opens the assistant). Right: View store, notifications,
 * theme, account; each names itself in a tooltip.
 */
export default function TopBar({
  user,
  storefrontUrl,
  bugReports,
  storeName,
  scrolled = false,
}: TopBarProps) {
  // Hooks
  const copy = useCopy(navigationContent)

  // Render logic
  const domain = hostOf(storefrontUrl)

  return (
    <header
      data-scrolled={scrolled || undefined}
      className="relative z-20 flex h-14 shrink-0 items-center gap-2 bg-sidebar px-3 md:pr-2 md:pl-1"
    >
      <SidebarTrigger
        aria-label={copy.togglePanel}
        className="size-9 rounded-sm text-muted-foreground hover:text-foreground"
      />
      <TopBarTip label={copy.tips.search(copy.search.shortcut)}>
        <button
          type="button"
          onClick={openPalette}
          aria-label={copy.search.field}
          className="flex h-9 w-full max-w-80 min-w-0 items-center gap-2 rounded-sm border border-input bg-input-surface pr-1.5 pl-3 text-left shadow-input transition-colors duration-150 ease-out hover:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-body text-muted-foreground">
            {copy.search.field}
          </span>
          <Kbd className="hidden sm:inline-flex">{copy.search.shortcut}</Kbd>
        </button>
      </TopBarTip>
      <TopBarTip label={copy.tips.askAi(modKey())}>
        <Button size="sm" onClick={() => openAssistant()} className="shrink-0">
          <AiIcon aria-hidden />
          {copy.search.askAi}
        </Button>
      </TopBarTip>

      <div className="ml-auto flex items-center gap-2">
        <TopBarTip label={copy.tips.viewStore(domain)}>
          <Button
            variant="outline"
            size="sm"
            className="hidden md:inline-flex"
            render={<a href={storefrontUrl} target="_blank" rel="noreferrer" />}
            nativeButton={false}
          >
            <ExternalLink aria-hidden />
            {copy.viewStore}
          </Button>
        </TopBarTip>
        <ActivityBell memberKey={user.email} className={ICON_BUTTON} />
        <ThemeToggle className={ICON_BUTTON} />
        <UserMenu
          user={user}
          bugReports={bugReports}
          variant="topbar"
          storeName={storeName}
          tip={copy.account}
          triggerLabel={copy.account}
          triggerClassName="flex size-9 shrink-0 items-center justify-center rounded-full transition-shadow duration-150 ease-out hover:ring-2 hover:ring-foreground hover:ring-offset-1 hover:ring-offset-sidebar focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
          trigger={
            <MemberAvatar
              name={user.name}
              email={user.email}
              image={user.image}
              className="size-9"
              fallbackClassName="bg-primary text-[0.8125rem] text-primary-foreground"
            />
          }
        />
      </div>
    </header>
  )
}
