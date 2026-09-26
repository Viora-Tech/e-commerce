'use client'

import {
  FileText,
  FolderOpen,
  Globe,
  Home,
  type IconComponent,
  Newspaper,
  Package,
  Search,
} from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import Image from 'next/image'
import { type FormEvent, useEffect, useState } from 'react'
import { customizeContent } from '@/data/customize'
import { searchLinkTargets } from '@/lib/customize-link-targets'
import {
  LINK_KINDS,
  type LinkKind,
  type LinkTarget,
  normalisePastedUrl,
} from '@/lib/customize-links'

type LinkPickerPanelProps = {
  /** The href currently stored, to tick the matching row. */
  value: string
  onPick: (href: string) => void
}

type Load = { state: 'loading' } | { state: 'failed' } | { state: 'done'; items: LinkTarget[] }

const copy = customizeContent.link

export const LINK_KIND_ICONS: Record<LinkKind | 'home' | 'url', IconComponent> = {
  product: Package,
  collection: FolderOpen,
  page: FileText,
  article: Newspaper,
  home: Home,
  url: Globe,
}

const SEARCH_DELAY_MS = 180

/**
 * The link picker's popover body, Shopify-style: search on top, one tab per
 * kind of storefront target, then the two shortcuts every link needs — the
 * home page and a pasted web address.
 */
export default function LinkPickerPanel({ value, onPick }: LinkPickerPanelProps) {
  // Hooks
  const [kind, setKind] = useState<LinkKind>('product')
  const [query, setQuery] = useState('')
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [pasted, setPasted] = useState('')
  const [pasteError, setPasteError] = useState(false)
  useEffect(() => {
    let active = true
    setLoad({ state: 'loading' })
    const timer = setTimeout(() => {
      searchLinkTargets(kind, query).then(
        (items) => active && setLoad({ state: 'done', items }),
        () => active && setLoad({ state: 'failed' }),
      )
    }, SEARCH_DELAY_MS)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [kind, query])

  // Event handlers
  const handlePaste = (e: FormEvent) => {
    e.preventDefault()
    const href = normalisePastedUrl(pasted)
    if (!href) {
      setPasteError(true)
      return
    }
    onPick(href)
  }

  // Render logic
  const HomeIcon = LINK_KIND_ICONS.home
  const UrlIcon = LINK_KIND_ICONS.url

  return (
    <div className="flex flex-col">
      <div className="relative p-2">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-4.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={copy.search}
          aria-label={copy.search}
          className="h-8 rounded-lg pl-8 text-[0.8125rem]"
        />
      </div>
      <div role="tablist" className="flex gap-1 border-b border-border px-2 pb-2">
        {LINK_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            onClick={() => setKind(k)}
            className={cn(
              'rounded-md px-2 py-1 text-xs font-medium transition-colors',
              kind === k
                ? 'bg-primary-soft text-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {copy.tabs[k]}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="flex h-56 flex-col gap-0.5 overflow-y-auto p-1.5">
        <Results kind={kind} load={load} value={value} onPick={onPick} />
      </div>
      <div className="flex flex-col gap-1 border-t border-border p-1.5">
        <button
          type="button"
          onClick={() => onPick('/')}
          className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[0.8125rem] hover:bg-muted"
        >
          <span className="flex size-6 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <HomeIcon aria-hidden weight="light" className="size-3.5" />
          </span>
          <span className="flex flex-col">
            <span className="font-medium">{copy.home}</span>
            <span className="text-xs text-muted-foreground">{copy.homeHint}</span>
          </span>
        </button>
        <form onSubmit={handlePaste} className="flex items-center gap-1.5 px-2 py-1">
          <UrlIcon aria-hidden weight="light" className="size-4 shrink-0 text-muted-foreground" />
          <Input
            value={pasted}
            onChange={(e) => {
              setPasted(e.target.value)
              setPasteError(false)
            }}
            placeholder={copy.pastePlaceholder}
            aria-label={copy.paste}
            aria-invalid={pasteError || undefined}
            className="h-7 rounded-md text-xs"
          />
          <Button type="submit" size="xs" variant="outline" disabled={!pasted.trim()}>
            {copy.pasteApply}
          </Button>
        </form>
        {pasteError ? <p className="px-2 text-xs text-destructive">{copy.pasteInvalid}</p> : null}
      </div>
    </div>
  )
}

type ResultsProps = {
  kind: LinkKind
  load: Load
  value: string
  onPick: (href: string) => void
}

/** The current tab's rows, or its loading, error or empty line. */
function Results({ kind, load, value, onPick }: ResultsProps) {
  // Early returns
  if (load.state === 'loading') {
    return <p className="px-2 py-3 text-xs text-muted-foreground">{copy.loading}</p>
  }
  if (load.state === 'failed') {
    return <p className="px-2 py-3 text-xs text-destructive">{copy.failed}</p>
  }
  if (load.items.length === 0) {
    return <p className="px-2 py-3 text-xs text-muted-foreground">{copy.empty}</p>
  }

  // Render logic
  const Icon = LINK_KIND_ICONS[kind]
  return (
    <>
      {load.items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onPick(item.href)}
          aria-current={item.href === value ? 'true' : undefined}
          className={cn(
            'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[0.8125rem] hover:bg-muted',
            item.href === value && 'bg-primary-soft hover:bg-primary-soft',
          )}
        >
          <span className="relative flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
            {item.imageUrl ? (
              <Image src={item.imageUrl} alt="" fill sizes="1.5rem" className="object-cover" />
            ) : (
              <Icon aria-hidden weight="light" className="size-3.5" />
            )}
          </span>
          <span className="min-w-0 flex-1 truncate">{item.title}</span>
        </button>
      ))}
    </>
  )
}
