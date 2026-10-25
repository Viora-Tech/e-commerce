'use client'

import type { BrowseSort } from '@commerce/core/browse'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { browseContent as copy, SORT_LABELS } from '@/data/browse'

type SortSelectProps = {
  action: string
  value: BrowseSort
  options: BrowseSort[]
  /** The current query and filters, carried as hidden fields so sorting keeps them. */
  keep: [string, string][]
}

/**
 * Sort as a menu that matches the theme: a button with the current order and a list that opens
 * under it (arrow keys, Enter, Escape, a click outside closes it). Until the page is interactive,
 * and without JavaScript, it is the plain select in a GET form with an Apply button.
 */
export default function SortSelect({ action, value, options, keep }: SortSelectProps) {
  // Hooks
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(() => Math.max(0, options.indexOf(value)))
  const root = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => setReady(true), [])
  useEffect(() => {
    if (!open) return
    list.current?.focus()
    const handleOutside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handleOutside)
    return () => document.removeEventListener('pointerdown', handleOutside)
  }, [open])

  // Helpers
  const go = (sort: string) => {
    const params = new URLSearchParams(keep)
    params.set('sort_by', sort)
    router.push(`${action}?${params.toString()}`, { scroll: false })
  }

  // Event handlers
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => go(e.target.value)
  const handlePick = (sort: BrowseSort) => {
    setOpen(false)
    if (sort !== value) go(sort)
  }
  const handleToggle = () => {
    setActive(Math.max(0, options.indexOf(value)))
    setOpen((o) => !o)
  }
  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown') setActive((i) => Math.min(options.length - 1, i + 1))
    else if (e.key === 'ArrowUp') setActive((i) => Math.max(0, i - 1))
    else if (e.key === 'Home') setActive(0)
    else if (e.key === 'End') setActive(options.length - 1)
    else if (e.key === 'Enter' || e.key === ' ') {
      const sort = options[active]
      if (sort) handlePick(sort)
    } else if (e.key === 'Escape' || e.key === 'Tab') setOpen(false)
    else return
    e.preventDefault()
  }

  // Early returns
  if (!ready)
    return (
      <form action={action} method="get" className="ml-auto flex items-center gap-2">
        {keep.map(([k, v]) => (
          <input key={`${k}=${v}`} type="hidden" name={k} value={v} />
        ))}
        <label htmlFor="sort-by" className="text-small text-muted whitespace-nowrap">
          {copy.sortLabel}
        </label>
        <select
          id="sort-by"
          name="sort_by"
          className="field__input !w-auto py-2"
          defaultValue={value}
          onChange={handleChange}
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {SORT_LABELS[o]}
            </option>
          ))}
        </select>
        <noscript>
          <button type="submit" className="btn btn--secondary btn--small">
            {copy.apply}
          </button>
        </noscript>
      </form>
    )

  // Render logic
  const listId = 'sort-by-list'
  return (
    <div ref={root} className="relative ml-auto">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={handleToggle}
        className="flex items-center gap-2 rounded-[var(--radius-input,0.5rem)] border border-line px-3 py-2 text-small transition-colors duration-150 hover:border-[var(--color-ink)]"
      >
        <span className="text-muted">{copy.sortLabel}</span>
        <span className="font-medium">{SORT_LABELS[value]}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className={`size-3.5 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      <div
        ref={list}
        id={listId}
        role="listbox"
        tabIndex={-1}
        aria-label={copy.sortLabel}
        aria-activedescendant={open ? `sort-opt-${options[active]}` : undefined}
        onKeyDown={handleKey}
        data-open={open ? '' : undefined}
        className="pointer-events-none absolute right-0 z-20 mt-2 min-w-[12rem] origin-top-right scale-[0.97] rounded-[var(--radius-card,0.75rem)] border border-line bg-[var(--color-background,#fff)] py-1 opacity-0 shadow-lg transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] outline-none data-[open]:pointer-events-auto data-[open]:scale-100 data-[open]:opacity-100 motion-reduce:transition-none"
      >
        {options.map((o, i) => (
          <button
            key={o}
            id={`sort-opt-${o}`}
            type="button"
            role="option"
            tabIndex={-1}
            aria-selected={o === value}
            onClick={() => handlePick(o)}
            onPointerEnter={() => setActive(i)}
            className={`flex w-full cursor-pointer items-center justify-between gap-4 px-3 py-2 text-left text-small ${i === active ? 'bg-surface' : ''}`}
          >
            {SORT_LABELS[o]}
            {o === value ? (
              <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5">
                <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  )
}
