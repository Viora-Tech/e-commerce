'use client'

import { paletteContent } from '@/data/command-palette'
import { useCopy } from '@/hooks/use-copy'
import type { PaletteSection } from '@/lib/palette-rows'
import PaletteRow from './palette-row'

type PaletteResultsProps = {
  sections: PaletteSection[]
  query: string
  listId: string
  activeId: string | null
  onHover: (rowId: string) => void
  onActivate: (rowId: string, newTab: boolean) => void
  onClearRecent: () => void
}

/** The listbox: grouped sections with their counts, each row an option the input points at. */
export default function PaletteResults({
  sections,
  query,
  listId,
  activeId,
  onHover,
  onActivate,
  onClearRecent,
}: PaletteResultsProps) {
  // Hooks
  const copy = useCopy(paletteContent)

  // Render logic
  const starts: number[] = []
  sections.reduce((n, section) => {
    starts.push(n)
    return n + section.rows.length
  }, 0)

  return (
    <div role="listbox" id={listId} aria-label={copy.title} className="flex flex-col gap-1 p-2">
      {sections.map((section, sectionIndex) => {
        const headingId = `${listId}-${section.key}-heading`
        return (
          // biome-ignore lint/a11y/useSemanticElements: a listbox group, not a form fieldset
          <div
            key={section.key}
            role="group"
            {...(section.heading ? { 'aria-labelledby': headingId } : {})}
            className="flex flex-col"
          >
            {section.heading ? (
              <div className="flex items-center justify-between px-3 pt-2 pb-1">
                <span id={headingId} className="text-caption font-medium text-muted-foreground">
                  {section.heading}
                  {section.count !== undefined ? (
                    <span className="ml-1.5 tabular-nums opacity-70">{section.count}</span>
                  ) : null}
                </span>
                {section.key === 'recent' ? (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={onClearRecent}
                    className="rounded-sm text-caption text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {copy.clearRecent}
                  </button>
                ) : null}
              </div>
            ) : null}
            {section.rows.map((row, rowIndex) => {
              const optionId = `${listId}-option-${(starts[sectionIndex] ?? 0) + rowIndex}`
              return (
                <PaletteRow
                  key={row.id}
                  row={row}
                  query={query}
                  optionId={optionId}
                  active={row.id === activeId}
                  onHover={() => onHover(row.id)}
                  onActivate={(newTab) => onActivate(row.id, newTab)}
                />
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
