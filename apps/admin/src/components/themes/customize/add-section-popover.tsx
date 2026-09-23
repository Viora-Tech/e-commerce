'use client'

import { SECTION_CATEGORIES } from '@commerce/blocks/puck'
import { GROUP_SECTIONS, type SectionGroup } from '@commerce/core/theme'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import { useState } from 'react'
import { customizeContent } from '@/data/customize'
import { useCustomizePuck } from '@/lib/customize-puck'
import SectionIcon from './section-icon'

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

/** Shopify's "Add section": a searchable list of sections with a glyph for each. */
export default function AddSectionPopover({ zone, group, count }: AddSectionPopoverProps) {
  // Hooks
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const dispatch = useCustomizePuck((s) => s.dispatch)
  const components = useCustomizePuck((s) => s.config.components)

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

  // Render logic
  const needle = query.trim().toLowerCase()
  const categories = categoriesFor(group)
    .map((c) => ({ ...c, types: c.types.filter((t) => labelOf(t).toLowerCase().includes(needle)) }))
    .filter((c) => c.types.length > 0)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="sm" className="w-full justify-start text-primary">
            <Plus aria-hidden />
            {customizeContent.tree.add}
          </Button>
        }
      />
      <PopoverContent align="start" side="right" className="flex w-72 flex-col gap-2 p-2">
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={copy.search}
          aria-label={copy.search}
        />
        <div className="flex max-h-96 flex-col gap-3 overflow-y-auto">
          {categories.length === 0 ? (
            <p className="px-2 py-4 text-caption text-muted-foreground">{copy.empty}</p>
          ) : null}
          {categories.map((c) => (
            <div key={c.title} className="flex flex-col gap-1">
              <p className="px-2 text-caption text-muted-foreground">{c.title}</p>
              <div className="grid grid-cols-2 gap-1">
                {c.types.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleAdd(type)}
                    className="flex flex-col items-start gap-2 rounded-md border border-border p-2 text-left text-caption text-foreground hover:border-primary hover:bg-accent"
                  >
                    <span className="flex h-12 w-full items-center justify-center rounded-sm bg-muted text-muted-foreground">
                      <SectionIcon type={type} className="size-5" />
                    </span>
                    {labelOf(type)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
