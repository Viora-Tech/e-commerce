'use client'

import { Monitor, Moon, Sun } from '@commerce/ui/icons'
import { useTheme } from 'next-themes'
import { useSyncExternalStore } from 'react'
import ChoiceCard from '@/components/layout/choice-card'
import { appearanceContent } from '@/data/appearance'

const copy = appearanceContent.mode
const MODES = [
  { id: 'light', label: copy.light, icon: Sun },
  { id: 'dark', label: copy.dark, icon: Moon },
  { id: 'system', label: copy.system, icon: Monitor },
] as const

const noSubscription = () => () => {}

/** Light, dark or follow the system as three option tiles; next-themes keeps it in this browser's storage. */
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
  const value = hydrated ? theme : undefined

  return (
    <fieldset>
      <legend className="mb-4 text-caption font-medium text-foreground">{copy.label}</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        {MODES.map((m) => (
          <ChoiceCard
            key={m.id}
            icon={m.icon}
            label={m.label}
            selected={value === m.id}
            onSelect={() => setTheme(m.id)}
            layout="row"
            showCheck
          />
        ))}
      </div>
    </fieldset>
  )
}
