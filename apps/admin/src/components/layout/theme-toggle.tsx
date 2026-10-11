'use client'

import { Moon, Sun } from '@commerce/ui/icons'
import { useTheme } from 'next-themes'
import { useSyncExternalStore } from 'react'
import { navigationContent } from '@/data/navigation'
import { useCopy } from '@/hooks/use-copy'

/* Nothing to subscribe to: the snapshot only differs between the server and the browser. */
const noSubscription = () => () => {}

/**
 * Light / dark switch for the top bar: a pill with a sun or moon thumb that slides across.
 * "System" is chosen under Account, Appearance; this flips between the two explicit themes.
 */
export default function ThemeToggle() {
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

  // Event handlers
  const handleToggle = () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')

  // Render logic
  const dark = hydrated && resolvedTheme === 'dark'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={copy.toggleTheme}
      onClick={handleToggle}
      className="relative flex h-8 w-14 shrink-0 items-center rounded-full border border-hairline bg-card px-0.5 transition-colors duration-180 ease-out hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
    >
      {/* The thumb follows the `dark` class next-themes sets before paint, so the server and
          the client render the same markup and nothing flashes. */}
      <span className="flex size-6 items-center justify-center rounded-full bg-ink-strong text-background transition-transform duration-180 ease-out dark:translate-x-6 motion-reduce:transition-none">
        <Sun className="size-3.5 dark:hidden" aria-hidden />
        <Moon className="hidden size-3.5 dark:block" aria-hidden />
      </span>
    </button>
  )
}
