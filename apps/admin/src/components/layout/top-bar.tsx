'use client'

import { Bell, LogOut, Moon, Search, Sun } from '@commerce/ui/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { Kbd } from '@commerce/ui/shadcn/kbd'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import { SidebarTrigger } from '@commerce/ui/shadcn/sidebar'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useSyncExternalStore } from 'react'
import { commandContent } from '@/data/command-palette'
import { navigationContent } from '@/data/navigation'
import { authClient } from '@/lib/auth-client'
import { openPalette } from '@/lib/palette-events'

type TopBarProps = {
  user: { name: string; email: string }
}

/* Nothing to subscribe to: the snapshot only differs between the server and the browser. */
const noSubscription = () => () => {}

function initials(name: string): string {
  return (
    name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U'
  )
}

/**
 * A slim, quiet header at the top of the white content panel (Saleor keeps chrome light):
 * the search field on the left (opens the command palette, as does ⌘K); notifications,
 * the light/dark switch and the account menu on the right. On phones it also opens the rail.
 */
export default function TopBar({ user }: TopBarProps) {
  // Hooks
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  /* The theme lives in localStorage, so the server cannot know it. False while
     hydrating (matching the server HTML), true straight after, without an effect. */
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  )

  // Event handlers
  const handleSignOut = async () => {
    await authClient.signOut()
    router.push('/login')
    router.refresh()
  }

  // Render logic
  const dark = hydrated && resolvedTheme === 'dark'

  return (
    <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-3 border-border border-b bg-card px-4 md:px-6">
      <SidebarTrigger className="-ml-1 md:hidden" aria-label={navigationContent.openMenu} />
      {/* The one search: a quiet field that opens the palette (records, actions, pages); ⌘K too. */}
      <div className="flex min-w-0 flex-1">
        <button
          type="button"
          onClick={openPalette}
          aria-label={commandContent.field}
          className="flex h-8 w-full max-w-md min-w-0 items-center gap-2 rounded-md border border-input bg-card px-2.5 text-left transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Search className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.6} />
          <span className="min-w-0 flex-1 truncate text-body text-muted-foreground">
            {commandContent.field}
          </span>
          <Kbd className="hidden sm:inline-flex">{navigationContent.search.shortcut}</Kbd>
        </button>
      </div>

      <div className="flex items-center gap-3">
        <Popover>
          <PopoverTrigger
            aria-label={navigationContent.notifications.label}
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Bell className="size-[1.125rem]" strokeWidth={1.6} />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72">
            <p className="text-body-strong">{navigationContent.notifications.label}</p>
            <p className="mt-1 text-body text-muted-foreground">
              {navigationContent.notifications.empty}
            </p>
          </PopoverContent>
        </Popover>

        <button
          type="button"
          role="switch"
          aria-checked={dark}
          aria-label={navigationContent.toggleTheme}
          onClick={() => setTheme(dark ? 'light' : 'dark')}
          className="flex h-6 w-11 items-center rounded-full bg-primary-soft p-0.5 transition-colors"
        >
          {/* Knob and icon follow the `dark` class next-themes sets before paint, so
              the markup is the same on the server and the client and never flashes. */}
          <span className="flex size-5 items-center justify-center rounded-full bg-card text-foreground shadow-toggle transition-transform duration-200 ease-out motion-reduce:transition-none dark:translate-x-5">
            <Sun className="size-3 dark:hidden" />
            <Moon className="hidden size-3 dark:block" />
          </span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={navigationContent.account}
            className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground ring-1 ring-border transition-shadow hover:ring-border-strong"
          >
            {initials(user.name)}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="grid leading-tight">
                <span className="truncate font-semibold">{user.name}</span>
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {user.email}
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleSignOut}>
              <LogOut className="size-4" />
              {navigationContent.signOut}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
