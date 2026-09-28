import type { ReactNode } from 'react'
import { CHROME_HEADING, CHROME_META } from '@/lib/customize-chrome'

type PanelHeaderProps = {
  title: ReactNode
  /** One quiet line under the title: what this panel is for, or where the selection sits. */
  hint?: ReactNode
  /** A glyph tile before the title (the selected section's icon). */
  icon?: ReactNode
  /** Small icon buttons at the end. */
  actions?: ReactNode
}

/**
 * The one header every Customize side panel wears (Sections, Add, Theme
 * settings, the selected section's settings): 13px semibold title with tight
 * tracking, an 11px muted hint, a hairline under it, so both sidebars read as
 * one system with the canvas between them.
 */
export default function PanelHeader({ title, hint, icon, actions }: PanelHeaderProps) {
  // Render logic
  return (
    <header className="flex min-h-13 shrink-0 items-center gap-2.5 border-b border-border px-4 py-2">
      {icon ? <span className="flex shrink-0 items-center justify-center">{icon}</span> : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <h2 className={`truncate text-foreground normal-case ${CHROME_HEADING}`}>{title}</h2>
        {hint ? <p className={`truncate ${CHROME_META}`}>{hint}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-0.5">{actions}</div> : null}
    </header>
  )
}
