'use client'

import { Monitor, Moon, Sun } from '@commerce/ui/icons'
import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import { useTheme } from 'next-themes'
import { useSyncExternalStore } from 'react'
import { appearanceContent } from '@/data/appearance'

const copy = appearanceContent.mode
const MODES = [
  { id: 'light', label: copy.light, icon: Sun },
  { id: 'dark', label: copy.dark, icon: Moon },
  { id: 'system', label: copy.system, icon: Monitor },
] as const

const noSubscription = () => () => {}

/** Light, dark or follow the system; next-themes keeps it in this browser's storage. */
export default function ThemeModeField() {
  // Hooks
  const { theme, setTheme } = useTheme()
  /* The server cannot know the stored mode: render nothing selected until hydrated,
     the same guard the top bar's switch uses (PR #77). */
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  )

  // Render logic
  const value = hydrated && theme ? [theme] : []

  return (
    <ToggleGroup
      aria-label={copy.label}
      value={value}
      onValueChange={(v) => v[0] && setTheme(v[0])}
      variant="outline"
      spacing={0}
    >
      {MODES.map((m) => (
        <ToggleGroupItem key={m.id} value={m.id} className="gap-1.5 px-3">
          <m.icon />
          {m.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
