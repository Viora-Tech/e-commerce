'use client'

import { Bell, Moon, SquareTerminal } from '@commerce/ui/icons'
import { Kbd } from '@commerce/ui/shadcn/kbd'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import { Switch } from '@commerce/ui/shadcn/switch'
import { useTheme } from 'next-themes'
import { useSyncExternalStore } from 'react'
import { navigationContent } from '@/data/navigation'
import { openPalette } from '@/lib/palette-events'

/* Nothing to subscribe to: the snapshot only differs between the server and the browser. */
const noSubscription = () => () => {}

/* Same 36px row as the nav, muted until hovered (Saleor's "Command menu ⌘K" rows). */
const ROW =
  'flex h-9 w-full min-w-0 items-center gap-2 rounded-[0.375rem] px-3 text-nav text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&>svg]:size-4 [&>svg]:shrink-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0'
const LABEL = 'min-w-0 flex-1 truncate text-left group-data-[collapsible=icon]:hidden'

/** The sidebar's bottom rows: command menu, notifications and the dark-mode switch. */
export default function SidebarUtilities() {
  // Hooks
  const { resolvedTheme, setTheme } = useTheme()
  /* The theme lives in localStorage, so the server cannot know it. False while
     hydrating (matching the server HTML), true straight after, without an effect. */
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  )

  // Event handlers
  const handleTheme = (checked: boolean) => setTheme(checked ? 'dark' : 'light')

  // Render logic
  const dark = hydrated && resolvedTheme === 'dark'

  return (
    <div className="flex flex-col gap-0.5 px-3">
      <button type="button" onClick={openPalette} className={ROW}>
        <SquareTerminal strokeWidth={1.8} />
        <span className={LABEL}>{navigationContent.commandMenu}</span>
        <Kbd className="group-data-[collapsible=icon]:hidden">
          {navigationContent.search.shortcut}
        </Kbd>
      </button>
      <Popover>
        <PopoverTrigger className={ROW}>
          <Bell strokeWidth={1.8} />
          <span className={LABEL}>{navigationContent.notifications.label}</span>
        </PopoverTrigger>
        <PopoverContent side="right" align="end" className="w-72">
          <p className="text-body-strong">{navigationContent.notifications.label}</p>
          <p className="mt-1 text-body text-muted-foreground">
            {navigationContent.notifications.empty}
          </p>
        </PopoverContent>
      </Popover>
      <div className={ROW}>
        <Moon strokeWidth={1.8} />
        <span className={LABEL}>{navigationContent.darkMode}</span>
        <Switch
          size="sm"
          checked={dark}
          onCheckedChange={handleTheme}
          aria-label={navigationContent.toggleTheme}
          className="group-data-[collapsible=icon]:hidden"
        />
      </div>
    </div>
  )
}
