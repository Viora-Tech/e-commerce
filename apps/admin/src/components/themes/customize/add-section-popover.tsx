'use client'

import { SECTION_CATEGORIES } from '@commerce/blocks/puck'
import { GROUP_SECTIONS, type SectionGroup } from '@commerce/core/theme'
import { Plus, Search } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { customizeContent } from '@/data/customize'
import { useCustomizePuck } from '@/lib/customize-puck'
import SectionIcon from './section-icon'
import SectionLivePreview from './section-live-preview'

type AddSectionPopoverProps = {
  /** Puck zone the section lands in, at the end. */
  zone: string
  /** Header and footer groups only take their own sections. */
  group: SectionGroup | null
  count: number
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

/** Shopify's "Add section": a searchable, categorised list with a glyph and one-line description each. */
export default function AddSectionPopover({ zone, group, count }: AddSectionPopoverProps) {
  // Hooks
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hovered, setHovered] = useState<string | null>(null)
  const dispatch = useCustomizePuck((s) => s.dispatch)
  const components = useCustomizePuck((s) => s.config.components)
  const reducedMotion = useReducedMotion()

  // Helpers
  const labelOf = (type: string) => components[type]?.label ?? type

  // Event handlers
  const handleAdd = (type: string) => {
    dispatch({
      type: 'insert',
      componentType: type,
      destinationIndex: count,
      destinationZone: zone,
    })
    dispatch({ type: 'setUi', ui: { itemSelector: { index: count, zone } } })
    setOpen(false)
    setQuery('')
  }
  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) setHovered(null)
  }

  // Render logic
  const needle = query.trim().toLowerCase()
  const categories = categoriesFor(group)
    .map((c) => ({ ...c, types: c.types.filter((t) => labelOf(t).toLowerCase().includes(needle)) }))
    .filter((c) => c.types.length > 0)
  const flatTypes = categories.flatMap((c) => c.types)

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="sm" className="w-full justify-start text-primary">
            <Plus aria-hidden />
            {customizeContent.tree.add}
          </Button>
        }
      />
      <PopoverContent align="start" side="right" className="relative flex w-96 flex-col gap-2 p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={copy.search}
            aria-label={copy.search}
            className="pl-8"
          />
        </div>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: clears the hover preview only; every item inside is its own focusable button. */}
        <div
          className="flex max-h-96 flex-col gap-1 overflow-y-auto"
          onMouseLeave={() => setHovered(null)}
        >
          {categories.length === 0 ? (
            <p className="px-2 py-4 text-caption text-muted-foreground">{copy.empty}</p>
          ) : null}
          {categories.map((c) => (
            <div key={c.title} className="flex flex-col">
              <p className="sticky top-0 bg-popover px-2 pt-2 pb-1 text-caption font-medium text-muted-foreground">
                {c.title}
              </p>
              {c.types.map((type) => (
                <motion.button
                  key={type}
                  type="button"
                  onClick={() => handleAdd(type)}
                  onMouseEnter={() => setHovered(type)}
                  onFocus={() => setHovered(type)}
                  initial={reducedMotion ? false : { opacity: 0, y: -2 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    reducedMotion
                      ? { duration: 0 }
                      : { duration: 0.12, delay: flatTypes.indexOf(type) * 0.012 }
                  }
                  className="flex items-start gap-3 rounded-md p-2 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <SectionIcon type={type} className="size-4" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-body-strong">{labelOf(type)}</span>
                    <span className="truncate text-caption text-muted-foreground">
                      {copy.descriptions[type] ?? ''}
                    </span>
                  </span>
                </motion.button>
              ))}
            </div>
          ))}
        </div>
        {hovered ? (
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.1 }}
            className="pointer-events-none absolute top-0 left-full ml-2 hidden w-52 flex-col gap-2 rounded-lg border border-border bg-popover p-2 shadow-popover lg:flex"
          >
            <SectionLivePreview type={hovered} className="aspect-video w-full" />
            <div className="flex flex-col gap-0.5 px-1 pb-1">
              <span className="text-body-strong">{labelOf(hovered)}</span>
              <span className="text-caption text-muted-foreground">
                {copy.descriptions[hovered] ?? ''}
              </span>
            </div>
          </motion.div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
