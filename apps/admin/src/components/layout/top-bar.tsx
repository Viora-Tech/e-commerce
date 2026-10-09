'use client'

import { AiIcon, Bell, ExternalLink, Moon, Search, Sun } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Kbd } from '@commerce/ui/shadcn/kbd'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import { SidebarTrigger } from '@commerce/ui/shadcn/sidebar'
import { useTheme } from 'next-themes'
import { useSyncExternalStore } from 'react'
import { navigationContent } from '@/data/navigation'
import { useCopy } from '@/hooks/use-copy'
import { openAssistant } from '@/lib/assistant-events'
import { initials } from '@/lib/initials'
import { openPalette } from '@/lib/palette-events'
import UserMenu from './user-menu'

type TopBarProps = {
  user: { name: string; email: string }
  /** Opens the live storefront in a new tab. */
  storefrontUrl: string
  /** Adds "Report a bug" to the account menu (test server only). */
  bugReports: boolean
}

/* Nothing to subscribe to: the snapshot only differs between the server and the browser. */
const noSubscription = () => () => {}

const ICON_BUTTON =
  'flex size-9 items-center justify-center rounded-full border border-hairline bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96] motion-reduce:active:scale-100'

/**
 * The top bar (Figma Home frame): full width to the right of the sidebar, on the shell colour.
 * Left: the sidebar toggle, the search field (opens the command palette, as does ⌘K) and the
 * "Ask AI" key pill (opens the assistant). Right: View store, notifications, theme, account.
 */
export default function TopBar({ user, storefrontUrl, bugReports }: TopBarProps) {
  // Hooks
  const copy = useCopy(navigationContent)
  const { resolvedTheme, setTheme } = useTheme()
  /* The theme lives in localStorage, so the server cannot know it. False while
     hydrating (matching the server HTML), true straight after, without an effect. */
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  )

  // Render logic
  const dark = hydrated && resolvedTheme === 'dark'

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 bg-sidebar px-3 md:pr-4 md:pl-1">
      <SidebarTrigger aria-label={copy.togglePanel} />
      <button
        type="button"
        onClick={openPalette}
        aria-label={copy.search.field}
        className="flex h-9 w-full max-w-80 min-w-0 items-center gap-2 rounded-md border border-hairline bg-card px-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Search className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.6} />
        <span className="min-w-0 flex-1 truncate text-body text-muted-foreground">
          {copy.search.field}
        </span>
        <Kbd className="hidden sm:inline-flex">{copy.search.shortcut}</Kbd>
      </button>
      <Button size="sm" onClick={() => openAssistant()} className="shrink-0">
        <AiIcon aria-hidden />
        {copy.search.askAi}
      </Button>

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="key-neutral"
          size="sm"
          className="hidden md:inline-flex"
          render={<a href={storefrontUrl} target="_blank" rel="noreferrer" />}
          nativeButton={false}
        >
          {copy.viewStore}
          <ExternalLink aria-hidden />
        </Button>
        <Popover>
          <PopoverTrigger aria-label={copy.notifications.label} className={ICON_BUTTON}>
            <Bell className="size-[1.125rem]" strokeWidth={1.6} />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72">
            <p className="text-body-strong">{copy.notifications.label}</p>
            <p className="mt-1 text-body text-muted-foreground">{copy.notifications.empty}</p>
          </PopoverContent>
        </Popover>
        <button
          type="button"
          aria-label={copy.toggleTheme}
          onClick={() => setTheme(dark ? 'light' : 'dark')}
          className={ICON_BUTTON}
        >
          {/* Follows the `dark` class next-themes sets before paint, so the server and the
              client render the same markup and nothing flashes. */}
          <Sun className="size-[1.125rem] dark:hidden" aria-hidden />
          <Moon className="hidden size-[1.125rem] dark:block" aria-hidden />
        </button>
        <UserMenu
          user={user}
          bugReports={bugReports}
          triggerLabel={copy.account}
          triggerClassName="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink-strong text-caption font-semibold text-background transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
          trigger={initials(user.name, user.email)}
        />
      </div>
    </header>
  )
}
