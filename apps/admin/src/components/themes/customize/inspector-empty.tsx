'use client'

import { Cursor, Layers, Plus } from '@commerce/ui/icons'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'

/** The tips' glyphs, in the order of `customizeContent.inspectorEmpty.tips`. */
const TIP_ICONS = [Cursor, Layers, Plus]

/**
 * The right panel when nothing is selected (Figma 369:129005: "Page", "Select a section to edit
 * it."): theme settings live only in the rail's Theme tab. Below the line, a small drawing of a
 * page with one section picked out and three ways to start.
 */
export default function InspectorEmpty() {
  // Hooks
  const copy = useCopy(customizeContent.inspectorEmpty)

  // Render logic
  return (
    <section aria-label={copy.title} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <header className="flex flex-col gap-3 px-4 pt-4">
        <h2 className="text-base leading-[1.4375rem] font-semibold text-foreground">
          {copy.title}
        </h2>
        <p className="text-xs leading-[1.0625rem] text-muted-foreground">{copy.body}</p>
      </header>
      <div className="flex flex-col gap-4 px-4 py-6">
        <div
          aria-hidden
          className="flex flex-col gap-1.5 rounded-xl border border-border bg-muted p-3"
        >
          <span className="h-2 w-1/3 rounded-full bg-muted-foreground/25" />
          <span className="flex h-12 items-center rounded-md border-[1.5px] border-primary bg-primary-soft px-2">
            <span className="h-1.5 w-1/2 rounded-full bg-primary/60" />
          </span>
          <span className="h-6 rounded-md bg-muted-foreground/15" />
          <span className="h-6 rounded-md bg-muted-foreground/15" />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-xs leading-[1.0625rem] font-medium text-foreground">
            {copy.tipsTitle}
          </p>
          <ul className="flex flex-col gap-2">
            {copy.tips.map((tip, i) => {
              const Icon = TIP_ICONS[i] ?? Plus
              return (
                <li
                  key={tip}
                  className="flex items-center gap-2 text-xs leading-[1.0625rem] text-muted-foreground"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                    <Icon aria-hidden weight="regular" className="size-3.5" />
                  </span>
                  {tip}
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </section>
  )
}
