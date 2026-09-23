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
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import { SidebarTrigger } from '@commerce/ui/shadcn/sidebar'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { navigationContent } from '@/data/navigation'
import { authClient } from '@/lib/auth-client'
import CommandPalette from './command-palette'

type TopBarProps = {
  title: string
  /** False on detail pages, which render their own h1 through PageHeader. */
  heading: boolean
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

/** Kit top bar: page title left; search pill, bell, theme switch and avatar right. */
export default function TopBar({ title, heading, user }: TopBarProps) {
  // Hooks
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const [paletteOpen, setPaletteOpen] = useState(false)
  /* The theme lives in localStorage, so the server cannot know it. False while
     hydrating (matching the server HTML), true straight after, without an effect. */
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  )
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Event handlers
  const handleSignOut = async () => {
    await authClient.signOut()
    router.push('/login')
    router.refresh()
  }

  // Render logic
  const dark = hydrated && resolvedTheme === 'dark'

  return (
    /* Part of the grey shell: the section name, the palette field, then the account controls. */
    <header className="relative z-10 flex h-14 shrink-0 items-center gap-4 bg-sidebar px-4 md:pr-5 md:pl-2">
      <SidebarTrigger className="-ml-2 md:hidden" />
      {heading ? (
        <h1 className="min-w-0 flex-1 truncate text-page-title text-ink-strong">{title}</h1>
      ) : (
        <p className="min-w-0 flex-1 truncate text-body-strong text-muted-foreground">{title}</p>
      )}

      {/* Command palette trigger drawn as a quiet field: hairline, 6px radius, glyph first. */}
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="hidden h-8 w-80 items-center gap-2 rounded-md border border-input bg-card px-2.5 text-left transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex"
      >
        <Search className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.6} />
        <span className="flex-1 truncate text-body text-muted-foreground">
          {navigationContent.search.placeholder}
        </span>
      </button>
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        aria-label={navigationContent.search.placeholder}
        className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted md:hidden"
      >
        <Search className="size-4" />
      </button>

      {/* Bell, theme switch and avatar as 32px ghost controls, 8px apart. */}
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger
            aria-label={navigationContent.notifications.label}
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Bell className="size-[1.125rem]" strokeWidth={1.6} />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72">
            <p className="text-body-strong font-bold">{navigationContent.notifications.label}</p>
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
          className="mx-1 flex h-6 w-11 items-center rounded-full border border-border bg-muted p-0.5 transition-colors hover:border-border-strong"
        >
          {/* Knob and icon follow the `dark` class next-themes sets before paint, so
              the markup is the same on the server and the client and never flashes. */}
          <span className="flex size-5 items-center justify-center rounded-full bg-card text-foreground shadow-toggle transition-transform duration-200 ease-out motion-reduce:transition-none dark:translate-x-[1.125rem]">
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
                <span className="truncate font-bold">{user.name}</span>
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

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  )
}
