'use client'

import { accentCss } from '@commerce/core/admin-accent'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { appearanceContent } from '@/data/appearance'
import SettingsToggleRow from './settings-toggle-row'

type AccentPreviewProps = {
  /** `#rrggbb` being tried; the preview recolours before anything is saved. */
  accent: string
}

const SCOPE = 'accent-preview'
const copy = appearanceContent.preview
const PILLS = [
  { id: 'all', label: copy.pillActive },
  { id: 'open', label: copy.pillIdle },
  { id: 'paid', label: copy.pillOther },
] as const

/**
 * A slice of the admin in the accent being tried: buttons, filter pills and a switch. The
 * scoped style block recolours only this subtree, in light and dark, so the rest of the page
 * keeps the saved colour until Save.
 */
export default function AccentPreview({ accent }: AccentPreviewProps) {
  // Hooks
  const [pill, setPill] = useState<(typeof PILLS)[number]['id']>('all')
  const [tracked, setTracked] = useState(true)

  // Render logic
  const css = accentCss(accent, `#${SCOPE}`)

  return (
    <div id={SCOPE} className="flex flex-col gap-4">
      {css ? (
        // biome-ignore lint/security/noDangerouslySetInnerHtml: accentCss builds this only from a validated hex and derived numbers; anything else yields ''.
        <style dangerouslySetInnerHTML={{ __html: css }} />
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button>{copy.primary}</Button>
        <Button variant="outline">{copy.secondary}</Button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {PILLS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={pill === p.id}
            onClick={() => setPill(p.id)}
            className={cn(
              'h-[1.875rem] rounded-full border px-3 text-body transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              pill === p.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-foreground hover:bg-muted',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <SettingsToggleRow
        id={`${SCOPE}-switch`}
        label={copy.switchLabel}
        description={copy.switchHelp}
        checked={tracked}
        onChange={setTracked}
        className="py-3 first:pt-3 last:pb-3"
      />
    </div>
  )
}
