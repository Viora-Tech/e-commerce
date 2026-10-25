'use client'

import type { IconComponent } from '@commerce/ui/icons'
import { CheckIcon } from '@commerce/ui/icons'
import type { ReactNode } from 'react'

type CodeNoticePanelProps = {
  icon: IconComponent
  title: string
  body: string
  /** Facts in a soft box, each with a check (Figma 699:93898). */
  facts?: readonly string[]
  actions?: ReactNode
}

/**
 * What Edit code shows instead of code (Figma 699:93898): a locked library section, an image,
 * or a file the theme editor owns. A card in the middle of the code area.
 */
export default function CodeNoticePanel({
  icon: Icon,
  title,
  body,
  facts,
  actions,
}: CodeNoticePanelProps) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-background p-8">
      <section className="flex w-full max-w-[32.5rem] flex-col gap-4 rounded-xl border border-border bg-card p-7 shadow-popover">
        <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
          <Icon aria-hidden className="size-4" />
        </span>
        <div className="flex flex-col gap-2">
          <h2 className="text-lg leading-6 font-semibold text-foreground">{title}</h2>
          <p className="text-body text-muted-foreground">{body}</p>
        </div>
        {facts?.length ? (
          <ul className="flex flex-col gap-1.5 rounded-lg bg-muted/60 p-4 text-caption text-muted-foreground">
            {facts.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <CheckIcon aria-hidden className="size-3.5 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        ) : null}
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </section>
    </div>
  )
}
