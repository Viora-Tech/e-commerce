'use client'

import { Search } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { type KeyboardEvent, type Ref, useId, useState } from 'react'
import { themeCodeContent } from '@/data/theme-code'
import { useCopy } from '@/hooks/use-copy'
import { codeFileName, searchCodeFiles } from '@/lib/theme-code'

type CodeSearchProps = {
  paths: readonly string[]
  onOpen: (path: string) => void
  /** ⌘P focuses this field. */
  ref?: Ref<HTMLInputElement>
}

/** "Search files ⌘P" (Figma 699:93624): type part of a name, arrows pick, Enter opens. */
export default function CodeSearch({ paths, onOpen, ref }: CodeSearchProps) {
  // Hooks
  const copy = useCopy(themeCodeContent.search)
  const listId = useId()
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)

  // Helpers
  const open = (path: string) => {
    onOpen(path)
    setQuery('')
    setIndex(0)
  }

  // Event handlers
  const handleChange = (value: string) => {
    setQuery(value)
    setIndex(0)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      const hit = results[index]
      if (hit) open(hit.path)
    } else if (e.key === 'Escape') {
      setQuery('')
      e.currentTarget.blur()
    }
  }

  // Render logic
  const results = searchCodeFiles(
    paths.map((path) => ({ path })),
    query,
  )
  const showList = query.trim().length > 0

  return (
    <div className="relative w-[16.25rem]">
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <input
        ref={ref}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-label={copy.label}
        placeholder={copy.placeholder}
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className="h-8 w-full rounded-lg border border-border bg-background pr-12 pl-9 text-body text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-border px-1 font-mono text-[0.6875rem] text-muted-foreground">
        ⌘P
      </kbd>
      {showList ? (
        <div className="absolute top-full right-0 left-0 z-30 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-popover">
          {results.length ? (
            <div
              id={listId}
              role="listbox"
              aria-label={copy.label}
              className="flex max-h-80 flex-col overflow-y-auto p-1"
            >
              {results.map((r, i) => (
                <button
                  key={r.path}
                  type="button"
                  role="option"
                  aria-selected={i === index}
                  tabIndex={-1}
                  // Keep focus in the field so the list stays open until the click lands.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => open(r.path)}
                  onMouseEnter={() => setIndex(i)}
                  className={cn(
                    'flex w-full flex-col items-start rounded-md px-2.5 py-1.5 text-left',
                    i === index && 'bg-muted',
                  )}
                >
                  <span className="text-body text-foreground">{codeFileName(r.path)}</span>
                  <span className="font-mono text-caption text-muted-foreground">{r.path}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="px-3 py-2 text-body text-muted-foreground">{copy.empty}</p>
          )}
        </div>
      ) : null}
    </div>
  )
}
