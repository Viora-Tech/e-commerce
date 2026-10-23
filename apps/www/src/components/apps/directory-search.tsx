'use client'

import { Search, X_ as X } from '@commerce/ui/icons'
import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef } from 'react'
import { appsContent as copy } from '@/data/apps'

type DirectorySearchProps = {
  value: string
  onChange: (value: string) => void
}

/** True when a key press lands in a field, where "/" is just a character. */
const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

/**
 * The directory's search: one large field that filters as you type. "/" focuses it from anywhere
 * on the page, Escape clears it, and the clear button appears once there is something to clear.
 */
export default function DirectorySearch({ value, onChange }: DirectorySearchProps) {
  // Hooks
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || isTyping(event.target)) return
      event.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Event handlers
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && value) {
      event.preventDefault()
      onChange('')
    }
  }

  const handleClear = () => {
    onChange('')
    inputRef.current?.focus()
  }

  return (
    <search className="group/search relative flex w-full max-w-xl items-center">
      <Search
        aria-hidden
        className="pointer-events-none absolute left-5 size-5 text-muted-foreground transition-colors duration-(--duration-popover) group-focus-within/search:text-foreground"
      />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={copy.searchPlaceholder}
        aria-label={copy.search}
        aria-keyshortcuts="/"
        autoComplete="off"
        spellCheck={false}
        className="glass-panel h-14 w-full rounded-full pr-14 pl-13 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/60 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={handleClear}
          aria-label={copy.clearSearch}
          className="absolute right-3 inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-[background-color,color,scale] duration-(--duration-press) ease-out outline-none hover:bg-foreground/10 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/60 active:scale-(--motion-press-scale)"
        >
          <X className="size-4" />
        </button>
      ) : (
        <kbd
          title={copy.searchKey}
          className="pointer-events-none absolute right-5 hidden h-6 min-w-6 items-center justify-center rounded-md px-1.5 font-mono text-xs text-muted-foreground ring-1 ring-border md:inline-flex"
        >
          /
        </kbd>
      )}
    </search>
  )
}
