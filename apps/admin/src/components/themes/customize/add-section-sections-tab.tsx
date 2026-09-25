'use client'

import { SECTION_CATEGORIES } from '@commerce/blocks/puck'
import { GROUP_SECTIONS, type SectionGroup } from '@commerce/core/theme'
import { customizeContent } from '@/data/customize'
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
      types: [...c.components],
    }))
  const allowed = GROUP_SECTIONS[group].filter((t) => t !== 'Header' && t !== 'Footer')
  return [{ title: customizeContent.groups[group], types: allowed }]
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
    .map((c) => ({ ...c, types: c.types.filter((t) => labelOf(t).toLowerCase().includes(needle)) }))
    .filter((c) => c.types.length > 0)
  if (categories.length === 0) {
    return <p className="px-2 py-4 text-caption text-muted-foreground">{copy.empty}</p>
  }

  // Render logic
  const flatTypes = categories.flatMap((c) => c.types)

  return (
    <>
      {categories.map((c) => (
        <div key={c.title} className="flex flex-col">
          <p className="sticky top-0 bg-popover px-2 pt-2 pb-1 text-caption font-medium text-muted-foreground">
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
              index={flatTypes.indexOf(type)}
            />
          ))}
        </div>
      ))}
    </>
  )
}
