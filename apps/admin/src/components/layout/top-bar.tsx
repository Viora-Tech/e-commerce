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
import { SidebarTrigger } from '@commerce/ui/shadcn/sidebar'
import { LogOut, Moon, Search, Sun } from 'lucide-react'
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

/** Kit top bar: section title left; search, theme switch and avatar right. */
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

  async function signOut() {
    await authClient.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="flex h-[72px] shrink-0 items-center gap-3 border-b border-border/60 bg-card px-4 md:px-6">
      <SidebarTrigger className="-ml-1 md:hidden" />
      {heading ? (
        <h1 className="min-w-0 flex-1 truncate text-page-title text-ink-strong normal-case">
          {title}
        </h1>
      ) : (
        <p className="min-w-0 flex-1 truncate text-page-title text-ink-strong normal-case">{title}</p>
      )}

      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="hidden h-10 w-full max-w-[360px] items-center gap-3 rounded-lg bg-muted px-4 text-[13px] text-muted-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex"
      >
        <span className="flex-1 truncate text-left">{navigationContent.search.placeholder}</span>
        <Kbd className="bg-card">{navigationContent.search.shortcut}</Kbd>
        <Search className="size-5" />
      </button>
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        aria-label={navigationContent.search.placeholder}
        className="flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
      >
        <Search className="size-5" />
      </button>

      <button
        type="button"
        role="switch"
        aria-checked={dark}
        aria-label={navigationContent.toggleTheme}
        onClick={() => setTheme(dark ? 'light' : 'dark')}
        className="flex h-8 w-14 items-center rounded-full bg-primary-soft p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
          className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary ring-offset-background hover:ring-2 hover:ring-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
