import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'

type PanelTitleProps = {
  title: string
  /** A small glyph before the title (the AI panel's spark). */
  icon?: ReactNode
  /** One control at the end: "New page", "Add", "New chat". */
  action?: ReactNode
  /** `lg` 16px for a panel's own head (Pages, Media, Theme settings); `md` 14px under the
   * store line (Layers). */
  size?: 'lg' | 'md'
}

/**
 * A left panel's head (Figma 381:6611, 369:121301, 385:4807): the panel's name in semibold on
 * the panel's 16px gutter, an optional glyph before it and one action after it, 16px above the
 * panel's content.
 */
export default function PanelTitle({ title, icon, action, size = 'lg' }: PanelTitleProps) {
  // Render logic
  return (
    <header className="flex min-h-[1.4375rem] shrink-0 items-center gap-2 px-4 pt-4 pb-4">
      {icon ? <span className="flex shrink-0 items-center text-primary">{icon}</span> : null}
      <h2
        className={cn(
          'min-w-0 flex-1 truncate font-semibold text-foreground',
          size === 'lg' ? 'text-base leading-[1.4375rem]' : 'text-sm leading-5',
        )}
      >
        {title}
      </h2>
      {action ? <div className="flex shrink-0 items-center">{action}</div> : null}
    </header>
  )
}
