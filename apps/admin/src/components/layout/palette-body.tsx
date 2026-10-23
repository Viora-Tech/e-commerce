'use client'

import { Search } from '@commerce/ui/icons'
import { Kbd } from '@commerce/ui/shadcn/kbd'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { type KeyboardEvent, useId, useState } from 'react'
import { paletteContent } from '@/data/command-palette'
import { useAssistantEnabled } from '@/hooks/use-assistant-enabled'
import { useCopy } from '@/hooks/use-copy'
import { usePaletteRecents } from '@/hooks/use-palette-recents'
import { usePaletteSearch } from '@/hooks/use-palette-search'
import { usePaletteSections } from '@/hooks/use-palette-sections'
import { usePermissions } from '@/hooks/use-permissions'
import { openAssistant } from '@/lib/assistant-events'
import { type PaletteRow, rowHref, rowRecent } from '@/lib/palette-rows'
import { cycleScope, type PaletteScope } from '@/lib/palette-search'
import { isExternalHref } from '@/lib/routes'
import PaletteFooter from './palette-footer'
import PaletteResults from './palette-results'
import PaletteScopeChips from './palette-scope-chips'
import PaletteState from './palette-state'

type PaletteBodyProps = {
  onClose: () => void
}

/** The palette's contents; mounted only while it is open, so every open starts clean. */
export default function PaletteBody({ onClose }: PaletteBodyProps) {
  // Hooks
  const copy = useCopy(paletteContent)
  const router = useRouter()
  const listId = useId()
  const { resolvedTheme, setTheme } = useTheme()
  const { hasPermission } = usePermissions()
  const aiEnabled = useAssistantEnabled()
  const { recents, add, clear } = usePaletteRecents()
  const [input, setInput] = useState('')
  const [scope, setScope] = useState<PaletteScope>('all')
  const [activeId, setActiveId] = useState<string | null>(null)
  const search = usePaletteSearch(input.trim(), scope, hasPermission)
  const view = usePaletteSections({
    query: input.trim(),
    scope,
    search,
    aiEnabled,
    recents,
    can: hasPermission,
  })

  // Helpers
  const activeIndex = () =>
    Math.max(
      0,
      view.rows.findIndex((r) => r.id === activeId),
    )

  const askAi = () => {
    onClose()
    openAssistant(input.trim())
  }

  const open = (row: PaletteRow, newTab: boolean) => {
    if (row.kind === 'ask') return askAi()
    if (row.kind === 'theme') {
      onClose()
      return setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
    }
    const href = rowHref(row)
    if (!href) return
    const recent = rowRecent(row, {
      order: copy.sections.orders,
      product: copy.sections.products,
      customer: copy.sections.customers,
    })
    if (recent) add(recent)
    if (newTab || isExternalHref(href)) {
      window.open(href, '_blank', 'noopener')
      return
    }
    onClose()
    router.push(href)
  }

  // Event handlers
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    const { rows } = view
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      const next = rows[(activeIndex() + step + rows.length) % Math.max(rows.length, 1)]
      if (next) setActiveId(next.id)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const row = rows[activeIndex()]
      if (row) open(row, e.metaKey || e.ctrlKey)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      setScope(cycleScope(scope, e.shiftKey ? -1 : 1))
    }
  }

  const handleChange = (value: string) => {
    setInput(value)
    setActiveId(null)
  }

  const handleActivate = (rowId: string, newTab: boolean) => {
    const row = view.rows.find((r) => r.id === rowId)
    if (row) open(row, newTab)
  }

  // Render logic
  const query = input.trim()
  const current = activeIndex()
  const activeOption = view.rows.length > 0 ? `${listId}-option-${current}` : undefined

  return (
    <div className="flex max-h-[min(36rem,calc(100dvh-8rem))] flex-col">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <Search aria-hidden className="size-5 shrink-0 text-muted-foreground" />
        <input
          // biome-ignore lint/a11y/noAutofocus: the palette exists to be typed into
          autoFocus
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={activeOption}
          aria-autocomplete="list"
          aria-label={copy.title}
          value={input}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={copy.placeholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          className="h-9 min-w-0 flex-1 bg-transparent text-[1.0625rem] text-foreground outline-none placeholder:text-muted-foreground"
        />
        <Kbd>{copy.esc}</Kbd>
      </div>
      <PaletteScopeChips scope={scope} onChange={setScope} />
      <p aria-live="polite" className="sr-only">
        {view.loading ? copy.loading : query ? copy.count(view.count) : ''}
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-hairline">
        <PaletteResults
          sections={view.shown}
          query={query}
          listId={listId}
          activeId={view.rows[current]?.id ?? null}
          onHover={setActiveId}
          onActivate={handleActivate}
          onClearRecent={clear}
        />
        {view.loading ? <PaletteState kind="loading" /> : null}
        {view.empty ? (
          <PaletteState kind="empty" query={query} onAskAi={aiEnabled ? askAi : null} />
        ) : null}
        {search.status === 'error' ? <PaletteState kind="error" onRetry={search.retry} /> : null}
      </div>
      <PaletteFooter />
    </div>
  )
}
