'use client'

import { Icon, type SearchShortcut, useFormatPaise } from '@commerce/blocks'
import { useEffect, useRef, useState } from 'react'
import { PREDICTIVE_DEBOUNCE_MS, searchContent } from '@/data/search'
import type { Suggestion } from '@/lib/suggestion'

type PredictiveSearchProps = {
  /** Accessible name of the header icon. */
  label: string
  /** Pills shown before the shopper types: popular terms and brands (Header section settings). */
  popular?: SearchShortcut[] | undefined
  brands?: SearchShortcut[] | undefined
}

const copy = searchContent
const LIST_ID = 'predictive-search-results'

/**
 * The header's search: a native <details> panel holding a GET form to /search,
 * so it opens and submits without JavaScript. With it, results appear as the
 * shopper types (debounced, stale requests aborted); Escape closes it.
 */
export default function PredictiveSearch({
  label,
  popular = [],
  brands = [],
}: PredictiveSearchProps) {
  // Hooks
  const formatPaise = useFormatPaise()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Suggestion[] | null>(null)
  const [loading, setLoading] = useState(false)
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setResults(null)
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        })
        setResults(res.ok ? ((await res.json()) as Suggestion[]) : [])
      } catch {
        // Aborted by the next keystroke, or offline: keep what is shown.
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, PREDICTIVE_DEBOUNCE_MS)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [q])

  // Helpers
  const close = () => {
    detailsRef.current?.removeAttribute('open')
  }

  // Event handlers
  const handleToggle = () => {
    if (detailsRef.current?.open) window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  /** Escape closes; the arrow keys walk between the box and the result links. */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      close()
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const links = [...(document.getElementById(LIST_ID)?.querySelectorAll('a') ?? [])]
    if (links.length === 0) return
    e.preventDefault()
    const stops: HTMLElement[] = [inputRef.current as HTMLElement, ...links]
    const at = stops.indexOf(document.activeElement as HTMLElement)
    const next =
      e.key === 'ArrowDown' ? (at + 1) % stops.length : (at - 1 + stops.length) % stops.length
    stops[next]?.focus()
  }

  // Render logic
  const term = q.trim()
  const open = results !== null && term.length >= 2
  const shortcuts = [
    { key: 'popular', heading: copy.predictive.popular, items: popular },
    { key: 'brands', heading: copy.predictive.brands, items: brands },
  ].filter((group) => group.items.length > 0)

  return (
    <details
      ref={detailsRef}
      onToggle={handleToggle}
      className="predictive-search header__search-details"
    >
      <summary
        className="header__icon-btn list-none [&::-webkit-details-marker]:hidden"
        aria-label={label}
      >
        <Icon name="search" size={24} />
      </summary>
      <div className="fixed inset-x-0 top-0 z-50 border-b border-line bg-bg shadow-lg">
        <search onKeyDown={handleKeyDown} className="page-width flex flex-col gap-3 py-4">
          <form action="/search" method="get" className="flex items-center gap-3">
            <label htmlFor="predictive-q" className="visually-hidden">
              {copy.label}
            </label>
            <input
              ref={inputRef}
              id="predictive-q"
              className="field__input flex-1"
              type="search"
              name="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={copy.placeholder}
              autoComplete="off"
              aria-controls={LIST_ID}
            />
            <button type="submit" className="btn btn--primary">
              {copy.submit}
            </button>
            <button
              type="button"
              className="header__icon-btn"
              onClick={close}
              aria-label={copy.clear}
            >
              <Icon name="close" size={24} />
            </button>
          </form>
          {!open && term.length < 2 && shortcuts.length > 0 ? (
            <div className="search-overlay__columns pb-2">
              {shortcuts.map((group) => (
                <div key={group.key} className="search-overlay__column">
                  <p className="search-overlay__heading">{group.heading}</p>
                  <div className="search-overlay__pills">
                    {group.items.map((item) => (
                      <a key={item.href} href={item.href} className="search-overlay__pill">
                        {item.label}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {open ? (
            <div className="flex flex-col gap-2 pb-2" aria-live="polite">
              {results.length === 0 ? (
                <p className="text-body text-muted">
                  {loading ? copy.predictive.loading : copy.predictive.empty(term)}
                </p>
              ) : (
                <>
                  <p className="text-small font-semibold uppercase tracking-wide text-muted">
                    {copy.predictive.products}
                  </p>
                  <ul id={LIST_ID} className="grid gap-1 md:grid-cols-2">
                    {results.map((r) => (
                      <li key={r.handle}>
                        <a
                          href={`/products/${r.handle}`}
                          className="flex items-center gap-3 rounded-xl p-2 outline-none hover:bg-surface focus-visible:bg-surface"
                        >
                          <span className="size-12 shrink-0 overflow-hidden rounded-lg bg-surface">
                            {r.image ? (
                              // biome-ignore lint/performance/noImgElement: product media is on the store's CDN.
                              <img
                                src={r.image.url}
                                alt={r.image.alt ?? ''}
                                className="size-full object-cover"
                              />
                            ) : null}
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-body font-medium">{r.title}</span>
                            <span className="text-small text-muted">
                              {formatPaise(r.pricePaise)}
                              {r.mrpPaise && r.mrpPaise > r.pricePaise ? (
                                <s className="ml-2">{formatPaise(r.mrpPaise)}</s>
                              ) : null}
                              {r.available ? null : ` · ${copy.soldOut}`}
                            </span>
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                  <a
                    href={`/search?q=${encodeURIComponent(term)}`}
                    className="text-body underline underline-offset-4"
                  >
                    {copy.predictive.viewAll(term)}
                  </a>
                </>
              )}
            </div>
          ) : null}
        </search>
      </div>
    </details>
  )
}
