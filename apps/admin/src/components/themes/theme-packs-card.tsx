'use client'

import type { ThemePackId } from '@commerce/core/theme'
import { useState } from 'react'
import { toast } from 'sonner'
import { themesContent } from '@/data/themes'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import SwitchField from './switch-field'

type ThemePacksCardProps = {
  /** The store's theme packs, read on the server (`themes.packs`). */
  initial: ThemePackId[]
}

const ZERO_DRIFT: ThemePackId = 'zero-drift'

/**
 * Online Store › Themes, "Section packs": turns a theme pack's sections (Zero Drift) on or off
 * in this store's Customize Add menu. Shown to owners and administrators only (settings manage).
 */
export default function ThemePacksCard({ initial }: ThemePacksCardProps) {
  // Hooks
  const [packs, setPacks] = useState(initial)
  const [busy, setBusy] = useState(false)
  const copy = useCopy(themesContent.packs)

  // Event handlers
  const handleZeroDrift = async (on: boolean) => {
    const next = on ? [...packs, ZERO_DRIFT] : packs.filter((p) => p !== ZERO_DRIFT)
    setBusy(true)
    try {
      setPacks(await api.themes.setPacks({ packs: next }))
      toast.success(on ? copy.on(copy.zeroDrift) : copy.off(copy.zeroDrift))
    } catch {
      toast.error(copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  return (
    <section
      aria-busy={busy || undefined}
      className="flex flex-col gap-4 rounded-2xl border border-border surface-card px-4 py-4 md:px-5"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="text-card-title">{copy.heading}</h2>
        <p className="text-[0.8125rem] leading-[1.1875rem] text-muted-foreground">{copy.body}</p>
      </div>
      <SwitchField
        label={copy.zeroDrift}
        help={copy.zeroDriftHelp}
        checked={packs.includes(ZERO_DRIFT)}
        onChange={handleZeroDrift}
        disabled={busy}
      />
    </section>
  )
}
