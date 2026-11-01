'use client'

import { TAG_PREFIX } from '@commerce/core/browse'
import type { FilterGroupConfig } from '@commerce/core/filter-config'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import { searchFiltersContent } from '@/data/search-filters'
import { useCopy } from '@/hooks/use-copy'
import type { FilterChoice } from '@/lib/search-filter-options'

type AddFilterDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Filters not yet in the list. */
  choices: FilterChoice[]
  onAdd: (group: FilterGroupConfig) => void
}

const KINDS = ['builtIn', 'tagGroups', 'metafields', 'options'] as const

/** Picks a filter to add, grouped by where its values come from, plus any tag prefix typed in. */
export default function AddFilterDialog({
  open,
  onOpenChange,
  choices,
  onAdd,
}: AddFilterDialogProps) {
  // Hooks
  const { dialog: copy } = useCopy(searchFiltersContent)
  const [prefix, setPrefix] = useState('')

  // Event handlers
  const handleAddPrefix = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const key = prefix.trim().toLowerCase().replace(/-+$/, '')
    if (!TAG_PREFIX.test(key)) return
    onAdd({ source: 'tagGroup', key })
    setPrefix('')
  }

  // Render logic
  const cleanPrefix = prefix.trim().toLowerCase().replace(/-+$/, '')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[60dvh] flex-col gap-5 overflow-y-auto overscroll-contain">
          {choices.length === 0 ? (
            <p className="text-sm text-muted-foreground">{copy.nothing}</p>
          ) : null}
          {KINDS.map((kind) => {
            const rows = choices.filter((c) => c.kind === kind)
            if (rows.length === 0) return null
            return (
              <section key={kind} className="flex flex-col gap-1">
                <h3 className="text-xs font-semibold text-muted-foreground">{copy[kind]}</h3>
                <ul className="flex flex-col">
                  {rows.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => onAdd(c.group)}
                        className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-[background-color] hover:bg-muted"
                      >
                        <Plus
                          aria-hidden="true"
                          className="size-4 shrink-0 text-muted-foreground"
                        />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-medium text-ink-strong">
                            {c.name}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">{c.detail}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
          <form onSubmit={handleAddPrefix} className="flex flex-col gap-1">
            <label
              htmlFor="filter-tag-prefix"
              className="text-xs font-semibold text-muted-foreground"
            >
              {copy.customPrefix}
            </label>
            <div className="flex gap-2">
              <Input
                id="filter-tag-prefix"
                value={prefix}
                maxLength={40}
                placeholder="hand"
                spellCheck={false}
                onChange={(e) => setPrefix(e.target.value)}
              />
              <Button type="submit" variant="outline" disabled={!TAG_PREFIX.test(cleanPrefix)}>
                {copy.customPrefixAdd}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{copy.customPrefixHelp}</p>
          </form>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {copy.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
