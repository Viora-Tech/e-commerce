'use client'

import { hiddenPackSections, sectionCategories } from '@commerce/blocks/puck'
import { GROUP_SECTIONS, type SectionGroup } from '@commerce/core/theme'
import { SearchX } from '@commerce/ui/icons'
import { customizeContent } from '@/data/customize'
import { useThemePacks } from '@/lib/customize-theme-context'
import AddSectionGroup from './add-section-group'
import SectionCard from './section-card'

/** The Add panel's two kinds (Figma's "Sections | Blocks" switch). */
export type AddKind = 'sections' | 'blocks'

type SectionsTabProps = {
  group: SectionGroup | null
  /** Sections lists the section library; Blocks the build-your-own layout and element blocks. */
  kind: AddKind
  query: string
  hovered: string | null
  /** Categories the merchant folded, by title; a search shows every match regardless. */
  closed: ReadonlySet<string>
  onToggle: (title: string) => void
  onHover: (type: string | null) => void
  labelOf: (type: string) => string
  onAdd: (type: string) => void
  /** Another group in the same list (the imported theme's) has matches, so an empty library is not an empty search. */
  othersMatch?: boolean
}

/** Library categories that are blocks to build with rather than whole sections. */
const BLOCK_CATEGORIES = new Set(['layout', 'elements'])

const copy = customizeContent.addSection

/**
 * Categories to offer: the library's sections or blocks for a template (a theme pack's only
 * when the store turned it on), the group's list for a group.
 */
function categoriesFor(group: SectionGroup | null, kind: AddKind, themePacks: readonly string[]) {
  if (!group)
    return Object.entries(sectionCategories(themePacks))
      .filter(([id]) => BLOCK_CATEGORIES.has(id) === (kind === 'blocks'))
      .flatMap(([, c]) => (c ? [{ title: c.title, types: c.components }] : []))
  // A header or footer group takes its own sections; it has no blocks of its own.
  if (kind === 'blocks') return []
  const hidden = hiddenPackSections(themePacks)
  const allowed = GROUP_SECTIONS[group].filter(
    (t) => t !== 'Header' && t !== 'Footer' && !hidden.has(t),
  )
  return [{ title: customizeContent.groups[group], types: [...allowed] }]
}

/** A section matches on its name or its one-line description. */
function matches(type: string, label: string, needle: string): boolean {
  if (!needle) return true
  const description = (copy.descriptions[type] ?? '').toLowerCase()
  return label.toLowerCase().includes(needle) || description.includes(needle)
}

/**
 * The Add panel's library (Figma 369:4899): each category a folding group of picture tiles, two
 * across, with a small caption above each.
 */
export default function SectionsTab({
  group,
  kind,
  query,
  hovered,
  closed,
  onToggle,
  onHover,
  labelOf,
  onAdd,
  othersMatch,
}: SectionsTabProps) {
  // Hooks
  const themePacks = useThemePacks()

  // Early returns
  const needle = query.trim().toLowerCase()
  const offered = categoriesFor(group, kind, themePacks)
  if (offered.length === 0) return null
  const categories = offered
    .map((c) => ({ ...c, types: c.types.filter((t) => matches(t, labelOf(t), needle)) }))
    .filter((c) => c.types.length > 0)
  if (categories.length === 0) {
    if (othersMatch) return null
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
        <AddSectionGroup
          key={c.title}
          title={c.title}
          open={Boolean(needle) || !closed.has(c.title)}
          onToggle={() => onToggle(c.title)}
        >
          <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">
            {c.types.map((type) => (
              <SectionCard
                key={type}
                layout="tile"
                type={type}
                label={labelOf(type)}
                description={copy.descriptions[type] ?? ''}
                hovered={hovered === type}
                onHover={onHover}
                onAdd={() => onAdd(type)}
              />
            ))}
          </div>
        </AddSectionGroup>
      ))}
    </>
  )
}
