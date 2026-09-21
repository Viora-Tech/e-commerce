'use client'

import { cn } from '@commerce/ui/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import { SidebarTrigger } from '@commerce/ui/shadcn/sidebar'
import { Bell, LogOut, Moon, Search, Sun } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { navigationContent } from '@/data/navigation'
import { authClient } from '@/lib/auth-client'
import { CommandPalette } from './command-palette'

type TopBarProps = {
  title: string
  /** False on detail pages, which render their own h1 through PageHeader. */
  heading: boolean
  user: { name: string; email: string }
}

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
export function TopBar({ title, heading, user }: TopBarProps) {
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const dark = resolvedTheme === 'dark'

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

  const handleSignOut = async () => {
    await authClient.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    /* 5:1347: 96px tall white bar; title 22/700 at x 24; controls 32px apart, 44px from the right edge. */
    <header className="flex h-14 shrink-0 items-center gap-6 bg-card pl-5 pr-6">
      <SidebarTrigger className="-ml-2 md:hidden" />
      {heading ? (
        <h1 className="min-w-0 flex-1 truncate text-page-title text-ink-strong">{title}</h1>
      ) : (
        <p className="min-w-0 flex-1 truncate text-page-title text-ink-strong">{title}</p>
      )}

      {/* 5:1349: 407 x 48 pill, 6px inner padding, placeholder 16px at 60% ink, 24px glyph in a 48px slot. */}
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="hidden h-8 w-80 items-center rounded-full bg-background p-1 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex"
      >
        <span className="flex-1 truncate px-6 text-[0.8125rem]  text-foreground/60">
          {navigationContent.search.placeholder}
        </span>
        <span className="flex h-9 w-12 items-center justify-center text-foreground">
          <Search className="size-4" strokeWidth={1.6} />
        </span>
      </button>
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        aria-label={navigationContent.search.placeholder}
        className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted md:hidden"
      >
        <Search className="size-4" />
      </button>

      {/* 5:1356: bell 24, toggle 56 x 32 on a soft-green track, 40px avatar; 20px apart. */}
      <div className="flex items-center gap-5">
        <Popover>
          <PopoverTrigger
            aria-label={navigationContent.notifications.label}
            className="flex size-5 items-center justify-center text-foreground hover:text-primary"
          >
            <Bell className="size-5" strokeWidth={1.6} />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72">
            <p className="text-sm font-bold">{navigationContent.notifications.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">
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
          <span
            className={cn(
              'flex size-5 items-center justify-center rounded-full bg-card text-foreground shadow-toggle transition-transform',
              dark && 'translate-x-5',
            )}
          >
            {dark ? <Moon className="size-3" /> : <Sun className="size-3" />}
          </span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={navigationContent.account}
            className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary ring-offset-background hover:ring-2 hover:ring-primary/30"
          >
            {initials(user.name)}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="grid leading-tight">
              <span className="truncate font-bold">{user.name}</span>
              <span className="truncate text-xs font-normal text-muted-foreground">
                {user.email}
              </span>
            </DropdownMenuLabel>
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
