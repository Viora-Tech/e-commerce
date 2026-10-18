'use client'

import {
  ArrowUpDown,
  Bookmark,
  Boxes,
  Braces,
  Columns,
  FieldText,
  FieldTextarea,
  FieldToggle,
  type IconComponent,
  ImageIcon,
  Images,
  InfoIcon,
  LayoutGrid,
  ListTree,
  Minus,
  Package,
  PanelTop,
  Search,
  StarIcon,
  Video,
} from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { useState } from 'react'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import {
  BLOCK_GROUPS,
  type BlockGroupId,
  blockLanding,
  slotAllows,
} from '@/lib/customize-add-block'
import { CHROME_FOCUS } from '@/lib/customize-chrome'
import type { CustomizeDoc } from '@/lib/customize-doc'
import { insertActions, sectionName } from '@/lib/customize-insert'
import { useCustomizePuck } from '@/lib/customize-puck'

type AddBlockPickerProps = {
  /** The slot the block goes in (`<parentId>:<prop>`). */
  zone: string
  index: number
  count: number
  onAdd: () => void
}

const ICONS: Record<string, IconComponent> = {
  Heading: FieldText,
  Text: FieldTextarea,
  Button: FieldToggle,
  Badge: Bookmark,
  Icon: StarIcon,
  Image: ImageIcon,
  VideoPlayer: Video,
  ProductCard: Package,
  CustomHtml: Braces,
  Columns,
  Grid: LayoutGrid,
  Group: Boxes,
  Accordion: ListTree,
  Tabs: PanelTop,
  Carousel: Images,
  Divider: Minus,
  Spacer: ArrowUpDown,
}

/**
 * "Add block" under a section (Figma 696:87552): a search, then Text, Media and Layout blocks
 * two across, only those the slot allows. The new block lands after the one above the "+" and
 * is selected straight away; the footer says where it goes.
 */
export default function AddBlockPicker({ zone, index, count, onAdd }: AddBlockPickerProps) {
  // Hooks
  const copy = useCopy(customizeContent.addBlock)
  const [query, setQuery] = useState('')
  const dispatch = useCustomizePuck((s) => s.dispatch)
  const components = useCustomizePuck((s) => s.config.components)
  const doc = useCustomizePuck((s) => s.appState.data as unknown as CustomizeDoc)

  // Helpers
  const labelOf = (type: string) => copy.labels[type] ?? components[type]?.label ?? type

  // Event handlers
  const handleAdd = (type: string) => {
    for (const action of insertActions({ zone, index }, type, count)) dispatch(action)
    onAdd()
  }

  // Render logic
  const allowed = slotAllows(doc, zone, (type) => components[type]?.fields as never)
  const needle = query.trim().toLowerCase()
  const groups = (Object.keys(BLOCK_GROUPS) as BlockGroupId[])
    .map((id) => ({
      id,
      types: BLOCK_GROUPS[id].filter(
        (t) =>
          components[t] &&
          (!allowed || allowed.includes(t)) &&
          (!needle || labelOf(t).toLowerCase().includes(needle)),
      ),
    }))
    .filter((g) => g.types.length > 0)
  const { parent, before } = blockLanding(doc, zone, index)
  const parentName = parent ? sectionName(parent, labelOf(parent.type)) : null
  const footer = parentName
    ? before
      ? copy.after(parentName, sectionName(before, labelOf(before.type)))
      : copy.first(parentName)
    : null

  return (
    <div className="flex max-h-[30rem] flex-col">
      <div className="relative p-2">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-4.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={copy.search}
          aria-label={copy.search}
          className="h-9 w-full rounded-lg border border-border bg-background pr-3 pl-8 text-[0.8125rem] text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
        {groups.length === 0 ? (
          <p className="px-2 py-3 text-[0.8125rem] text-muted-foreground">{copy.empty}</p>
        ) : (
          groups.map((g) => (
            <section
              key={g.id}
              aria-label={copy.groups[g.id]}
              className="flex flex-col gap-0.5 pb-2"
            >
              <h3 className="px-2 py-1 text-[0.625rem] leading-4 font-medium tracking-[0.06em] text-muted-foreground uppercase">
                {copy.groups[g.id]}
              </h3>
              <div className="grid grid-cols-2 gap-0.5">
                {g.types.map((type) => {
                  const Icon = ICONS[type] ?? Boxes
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleAdd(type)}
                      className={cn(
                        'flex h-8 items-center gap-2 rounded-md px-2 text-left text-[0.8125rem] text-foreground transition-colors hover:bg-muted',
                        CHROME_FOCUS,
                      )}
                    >
                      <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{labelOf(type)}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          ))
        )}
      </div>
      {footer ? (
        <p className="flex items-center gap-2 border-t border-border px-4 py-2.5 text-xs leading-[1.0625rem] text-muted-foreground">
          <InfoIcon aria-hidden className="size-3.5 shrink-0" />
          {footer}
        </p>
      ) : null}
    </div>
  )
}
