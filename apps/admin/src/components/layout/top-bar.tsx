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
import { Kbd } from '@commerce/ui/shadcn/kbd'
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
export function TopBar({ title, user }: TopBarProps) {
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

  async function signOut() {
    await authClient.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="flex h-[72px] shrink-0 items-center gap-3 border-b border-border/60 bg-card px-4 md:px-6">
      <SidebarTrigger className="-ml-1 md:hidden" />
      <h1 className="min-w-0 flex-1 truncate text-page-title text-ink-strong normal-case">
        {title}
      </h1>

      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="hidden h-11 w-full max-w-[360px] items-center gap-3 rounded-full bg-muted px-5 text-[12px] text-muted-foreground transition-colors hover:bg-secondary md:flex"
      >
        <span className="flex-1 truncate text-left">{navigationContent.search.placeholder}</span>
        <Kbd className="bg-card">{navigationContent.search.shortcut}</Kbd>
        <Search className="size-5" />
      </button>
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        aria-label={navigationContent.search.placeholder}
        className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted md:hidden"
      >
        <Search className="size-5" />
      </button>

      <Popover>
        <PopoverTrigger
          aria-label={navigationContent.notifications.label}
          className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Bell className="size-5" />
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
        className="flex h-8 w-14 items-center rounded-full bg-primary-soft p-1 transition-colors"
      >
        <span
          className={cn(
            'flex size-6 items-center justify-center rounded-full bg-card text-foreground shadow-toggle transition-transform',
            dark && 'translate-x-6',
          )}
        >
          {dark ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
        </span>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={navigationContent.account}
          className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary ring-offset-background hover:ring-2 hover:ring-primary/30"
        >
          {initials(user.name)}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="grid leading-tight">
            <span className="truncate font-bold">{user.name}</span>
            <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={signOut}>
            <LogOut className="size-4" />
            {navigationContent.signOut}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  )
}
