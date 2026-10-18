'use client'

import { Search } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Input } from '@commerce/ui/shadcn/input'
import { useRouter } from 'next/navigation'
import { type KeyboardEvent, useId, useState } from 'react'
import { settingsSearchContent as copy, SETTINGS_SEARCH_INDEX } from '@/data/settings-search'
import { searchSettings, settingsPageOf } from '@/lib/settings-search'

const optionId = (listId: string, i: number) => `${listId}-option-${i}`

/**
 * "Search settings…" at the top of the settings nav: type a plain word ("UPI",
 * "courier", "GST"), move with ↑/↓, press Enter to open. Everything is local.
 */
export default function SettingsSearch() {
  // Hooks
  const router = useRouter()
  const listId = useId()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState(false)

  // Helpers
  const resultsFor = () => searchSettings(SETTINGS_SEARCH_INDEX, query)
  const go = (href: string) => {
    setQuery('')
    setOpen(false)
    setActive(0)
    router.push(href)
  }

  // Event handlers
  const handleChange = (value: string) => {
    setQuery(value)
    setActive(0)
    setOpen(true)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const results = resultsFor()
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      const hit = results[active]
      if (hit) {
        e.preventDefault()
        go(hit.href)
      }
    } else if (e.key === 'Escape') {
      setQuery('')
      setOpen(false)
    }
  }

  const handleBlur = () => setOpen(false)
  const handleFocus = () => setOpen(true)

  // Render logic
  const results = resultsFor()
  const showList = open && query.trim().length > 0

  return (
    <div className="relative w-full">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        role="combobox"
        aria-label={copy.label}
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && results[active] ? optionId(listId, active) : undefined}
        placeholder={copy.placeholder}
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        autoComplete="off"
        className="h-9 pl-9"
      />
      {showList ? (
        <div className="absolute top-full right-0 left-0 z-30 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-dialog md:w-[20rem]">
          {results.length === 0 ? (
            <p className="p-3 text-caption text-muted-foreground">{copy.empty(query.trim())}</p>
          ) : (
            <>
              <div id={listId} role="listbox" aria-label={copy.label} className="flex flex-col p-1">
                {results.map((r, i) => (
                  <button
                    type="button"
                    key={`${r.href}-${r.title}`}
                    id={optionId(listId, i)}
                    role="option"
                    aria-selected={i === active}
                    tabIndex={-1}
                    // Keep focus in the input so the list stays open until the click lands.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => go(r.href)}
                    onMouseEnter={() => setActive(i)}
                    className={cn(
                      'flex cursor-pointer flex-col rounded-md px-3 py-2 text-left',
                      i === active && 'bg-accent',
                    )}
                  >
                    <span className="text-body font-medium text-foreground">{r.title}</span>
                    <span className="text-caption text-muted-foreground">
                      {settingsPageOf(r.where)}
                    </span>
                  </button>
                ))}
              </div>
              <p className="border-border border-t px-3 py-1.5 text-caption text-muted-foreground">
                {copy.hint}
              </p>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
