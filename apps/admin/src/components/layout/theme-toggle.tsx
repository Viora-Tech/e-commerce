'use client'

import { CheckIcon, type IconComponent, Monitor, Moon, Sun } from '@commerce/ui/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { useTheme } from 'next-themes'
import { useSyncExternalStore } from 'react'
import { navigationContent } from '@/data/navigation'
import { useCopy } from '@/hooks/use-copy'
import TopBarTip from './top-bar-tip'

type ThemeToggleProps = {
  /** The trigger's classes (the top bar's round icon button). */
  className: string
}

type ThemeChoice = 'light' | 'dark' | 'system'

const CHOICES: readonly { value: ThemeChoice; icon: IconComponent }[] = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
  { value: 'system', icon: Monitor },
]

/* Figma "Theme menu": 210px, radius 12, 6px inset, solid popover with a hairline and shadow-lg. */
const MENU = 'w-[13.125rem] rounded-lg! border border-border bg-popover! p-1.5 shadow-popover!'
/* Figma menu "Item": 32px, 10px sides and gap, radius 8, 16px icon, 13px label. */
const ITEM = 'min-h-8 gap-2.5 rounded-sm px-2.5 py-2 text-[0.8125rem] leading-4'

/* Nothing to subscribe to: the snapshot only differs between the server and the browser. */
const noSubscription = () => () => {}

function isChoice(value: string | undefined): value is ThemeChoice {
  return value === 'light' || value === 'dark' || value === 'system'
}

/**
 * The top bar's theme button (Figma "TB · Theme menu"): a sun or moon icon button that opens
 * Light, Dark and System; the current choice carries a check. Same setting as Account,
 * Appearance (next-themes, stored in this browser).
 */
export default function ThemeToggle({ className }: ThemeToggleProps) {
  // Hooks
  const copy = useCopy(navigationContent)
  const { theme, setTheme } = useTheme()
  /* The theme lives in localStorage, so the server cannot know it. False while
     hydrating (matching the server HTML), true straight after, without an effect. */
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  )

  // Render logic
  const current: ThemeChoice | null = hydrated && isChoice(theme) ? theme : null
  const tip = current ? copy.tips.theme(copy.theme[current]) : copy.toggleTheme

  return (
    <DropdownMenu>
      <TopBarTip label={tip}>
        <DropdownMenuTrigger aria-label={copy.toggleTheme} className={className}>
          {/* The icon follows the `dark` class next-themes sets before paint, so the server and
              the client render the same markup and nothing flashes. */}
          <Sun className="size-4 dark:hidden" aria-hidden />
          <Moon className="hidden size-4 dark:block" aria-hidden />
        </DropdownMenuTrigger>
      </TopBarTip>
      <DropdownMenuContent align="end" sideOffset={8} className={MENU}>
        {CHOICES.map((choice) => (
          <DropdownMenuItem
            key={choice.value}
            onClick={() => setTheme(choice.value)}
            aria-current={current === choice.value ? 'true' : undefined}
            className={ITEM}
          >
            <choice.icon className="size-4" />
            <span className="flex min-w-0 flex-1 flex-col gap-px">
              <span className="text-foreground">{copy.theme[choice.value]}</span>
              {choice.value === 'system' ? (
                <span className="text-[0.6875rem] leading-[0.875rem] text-muted-foreground">
                  {copy.theme.systemHint}
                </span>
              ) : null}
            </span>
            {current === choice.value ? <CheckIcon className="ml-auto size-3.5" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
