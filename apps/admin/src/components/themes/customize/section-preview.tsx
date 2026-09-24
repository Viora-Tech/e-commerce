import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'
import { SECTION_ICONS } from '@/lib/customize-puck'

type SectionPreviewProps = { type: string; className?: string }

const bar = 'rounded-full bg-muted-foreground/30'

/** A static schematic mockup of a section's layout, keyed by its glyph. */
const SHAPES: Record<string, () => ReactNode> = {
  image: () => (
    <div className="flex size-full flex-col items-center justify-center gap-2 bg-muted p-4">
      <div className={cn(bar, 'h-2 w-2/3')} />
      <div className={cn(bar, 'h-1.5 w-1/2')} />
      <div className="mt-1 h-3 w-1/3 rounded-full border border-muted-foreground/40" />
    </div>
  ),
  megaphone: () => (
    <div className="flex size-full flex-col items-center justify-center gap-1.5 bg-muted p-4">
      <div className={cn(bar, 'h-2 w-3/4')} />
    </div>
  ),
  text: () => (
    <div className="flex size-full flex-col justify-center gap-1.5 bg-muted p-5">
      <div className={cn(bar, 'h-1.5 w-full')} />
      <div className={cn(bar, 'h-1.5 w-5/6')} />
      <div className={cn(bar, 'h-1.5 w-2/3')} />
    </div>
  ),
  columns: () => (
    <div className="flex size-full items-center justify-center gap-2 bg-muted p-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
          <div className="size-3 rounded-full border border-muted-foreground/40" />
          <div className={cn(bar, 'h-1.5 w-full')} />
          <div className={cn(bar, 'h-1.5 w-2/3')} />
        </div>
      ))}
    </div>
  ),
  quote: () => (
    <div className="flex size-full flex-col items-center justify-center gap-2 bg-muted p-5">
      <div className={cn(bar, 'h-1.5 w-4/5')} />
      <div className={cn(bar, 'h-1.5 w-3/5')} />
      <div className="mt-1 size-2.5 rounded-full bg-muted-foreground/40" />
    </div>
  ),
  list: () => (
    <div className="flex size-full flex-col justify-center gap-2 bg-muted p-5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center justify-between border-b border-border pb-1.5">
          <div className={cn(bar, 'h-1.5 w-2/3')} />
          <div className="size-1.5 rounded-full bg-muted-foreground/40" />
        </div>
      ))}
    </div>
  ),
  shapes: () => (
    <div className="flex size-full items-center justify-center gap-2 bg-muted p-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-4 w-6 rounded border border-muted-foreground/40" />
      ))}
    </div>
  ),
  grid: () => (
    <div className="grid size-full grid-cols-2 gap-1.5 bg-muted p-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded border border-muted-foreground/40 bg-background/60" />
      ))}
    </div>
  ),
  package: () => (
    <div className="flex size-full items-center gap-2 bg-muted p-3">
      <div className="h-full w-1/2 rounded border border-muted-foreground/40 bg-background/60" />
      <div className="flex flex-1 flex-col gap-1.5">
        <div className={cn(bar, 'h-1.5 w-full')} />
        <div className={cn(bar, 'h-1.5 w-2/3')} />
        <div className="mt-1 h-2.5 w-1/2 rounded-full border border-muted-foreground/40" />
      </div>
    </div>
  ),
  folder: () => (
    <div className="grid size-full grid-cols-3 gap-1.5 bg-muted p-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded border border-muted-foreground/40 bg-background/60" />
      ))}
    </div>
  ),
  video: () => (
    <div className="flex size-full items-center justify-center bg-muted p-4">
      <div className="flex size-8 items-center justify-center rounded-full border border-muted-foreground/40">
        <div className="ml-0.5 size-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-muted-foreground/60" />
      </div>
    </div>
  ),
  news: () => (
    <div className="flex size-full items-center justify-center gap-2 bg-muted p-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-1 flex-col gap-1">
          <div className="h-6 w-full rounded border border-muted-foreground/40 bg-background/60" />
          <div className={cn(bar, 'h-1.5 w-full')} />
        </div>
      ))}
    </div>
  ),
  send: () => (
    <div className="flex size-full flex-col items-center justify-center gap-2 bg-muted p-5">
      <div className={cn(bar, 'h-1.5 w-2/3')} />
      <div className="flex w-4/5 items-center gap-1.5">
        <div className="h-3 flex-1 rounded-full border border-muted-foreground/40" />
        <div className="h-3 w-6 rounded-full bg-muted-foreground/40" />
      </div>
    </div>
  ),
}

/** A small static layout mockup for a section type, shown in the add-section preview pane. */
export default function SectionPreview({ type, className }: SectionPreviewProps) {
  // Render logic
  const key = SECTION_ICONS[type] ?? 'text'
  const render = SHAPES[key] ?? SHAPES.text
  const shape = render ? render() : null
  return (
    <div className={cn('overflow-hidden rounded-md border border-border', className)}>{shape}</div>
  )
}
