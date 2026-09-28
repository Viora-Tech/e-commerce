'use client'

import { SECTION_CATEGORIES } from '@commerce/blocks/puck'
import { GROUP_SECTIONS, type SectionGroup } from '@commerce/core/theme'
import { SearchX } from '@commerce/ui/icons'
import { customizeContent } from '@/data/customize'
import { CHROME_GROUP_LABEL } from '@/lib/customize-chrome'
import SectionCard from './section-card'

type SectionsTabProps = {
  group: SectionGroup | null
  query: string
  hovered: string | null
  onHover: (type: string | null) => void
  labelOf: (type: string) => string
  onAdd: (type: string) => void
}

const copy = customizeContent.addSection

/** Categories to offer: the whole library for a template, the group's list for a group. */
function categoriesFor(group: SectionGroup | null) {
  if (!group)
    return Object.values(SECTION_CATEGORIES).map((c) => ({
      title: c.title,
      types: [...c.components] as string[],
    }))
  const allowed = GROUP_SECTIONS[group].filter((t) => t !== 'Header' && t !== 'Footer')
  return [{ title: customizeContent.groups[group], types: [...allowed] }]
}

/** A section matches on its name or its one-line description. */
function matches(type: string, label: string, needle: string): boolean {
  if (!needle) return true
  const description = (copy.descriptions[type] ?? '').toLowerCase()
  return label.toLowerCase().includes(needle) || description.includes(needle)
}

/** The Add panel's Sections tab: our own section library, grouped into categories. */
export default function SectionsTab({
  group,
  query,
  hovered,
  onHover,
  labelOf,
  onAdd,
}: SectionsTabProps) {
  // Early returns
  const needle = query.trim().toLowerCase()
  const categories = categoriesFor(group)
    .map((c) => ({ ...c, types: c.types.filter((t) => matches(t, labelOf(t), needle)) }))
    .filter((c) => c.types.length > 0)
  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
        <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <SearchX aria-hidden className="size-4" />
        </span>
        <p className="text-[0.8125rem] font-medium text-foreground">{copy.empty}</p>
        <p className="text-xs text-muted-foreground">{copy.emptyHint}</p>
      </div>
    )
  }

  // Render logic
  return (
    <>
      {categories.map((c) => (
        <div key={c.title} className="flex flex-col">
          <p
            className={`sticky top-0 z-10 bg-[var(--add-surface,var(--popover))] px-2 pt-3 pb-1 ${CHROME_GROUP_LABEL}`}
          >
            {c.title}
          </p>
          {c.types.map((type) => (
            <SectionCard
              key={type}
              type={type}
              label={labelOf(type)}
              description={copy.descriptions[type] ?? ''}
              hovered={hovered === type}
              onHover={onHover}
              onAdd={() => onAdd(type)}
            />
          ))}
        </div>
      ))}
    </>
  )
}
