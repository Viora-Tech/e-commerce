'use client'

import type { ThemePackId } from '@commerce/core/theme'
import { useState } from 'react'
import { toast } from 'sonner'
import { themesContent } from '@/data/themes'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import SwitchField from './switch-field'
import type { ThemeItem } from './theme-types'

type ThemePacksCardProps = {
  /** The store's themes, live first, each with the packs its Customize offers (`packs`). */
  themes: ThemeItem[]
  /** A theme's packs were saved: the library keeps its copy of the theme in step. */
  onSaved: (themeId: string, packs: ThemePackId[]) => void
}

const ZERO_DRIFT: ThemePackId = 'zero-drift'

/**
 * Online Store › Themes, "Section packs": turns a theme pack's sections (Zero Drift) on or off in
 * one theme's Customize Add menu, a switch per theme, so a pack stays with the theme it was made
 * for. Shown to owners and administrators only (settings manage).
 */
export default function ThemePacksCard({ themes, onSaved }: ThemePacksCardProps) {
  // Hooks
  const [busy, setBusy] = useState<string | null>(null)
  const copy = useCopy(themesContent.packs)

  // Event handlers
  const handleZeroDrift = async (theme: ThemeItem, on: boolean) => {
    const next = on ? [...theme.packs, ZERO_DRIFT] : theme.packs.filter((p) => p !== ZERO_DRIFT)
    setBusy(theme.id)
    try {
      onSaved(theme.id, await api.themes.setPacks({ id: theme.id, packs: next }))
      toast.success(on ? copy.on(copy.zeroDrift, theme.name) : copy.off(copy.zeroDrift, theme.name))
    } catch {
      toast.error(copy.failed)
    } finally {
      setBusy(null)
    }
  }

  // Render logic
  return (
    <section
      aria-busy={busy !== null || undefined}
      className="flex flex-col gap-4 rounded-2xl border border-border surface-card px-4 py-4 md:px-5"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="text-card-title">{copy.heading}</h2>
        <p className="text-[0.8125rem] leading-[1.1875rem] text-muted-foreground">{copy.body}</p>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-body font-medium text-foreground">{copy.zeroDrift}</h3>
        <p className="text-[0.8125rem] leading-[1.1875rem] text-muted-foreground">
          {copy.zeroDriftHelp}
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {themes.map((t) => (
          <li key={t.id}>
            <SwitchField
              label={t.role === 'main' ? copy.live(t.name) : t.name}
              checked={t.packs.includes(ZERO_DRIFT)}
              onChange={(on) => handleZeroDrift(t, on)}
              disabled={busy !== null}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
