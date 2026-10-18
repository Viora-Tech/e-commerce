'use client'

import { CheckIcon, Search } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Input } from '@commerce/ui/shadcn/input'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useEffect, useState } from 'react'
import EmptyState from '@/components/layout/empty-state'
import { fieldInputContent } from '@/data/metaobjects'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import ReferenceThumb from './reference-thumb'

/** What a reference picker can search (the API's `REFERENCE_KINDS`). */
export type ReferenceKind = Parameters<typeof api.metaobjects.references>[0]['kind']
export type ReferenceOption = Awaited<ReturnType<typeof api.metaobjects.references>>[number]

type ReferenceSearchDialogProps = {
  open: boolean
  kind: ReferenceKind
  definitionId?: string | undefined
  title: string
  selected: string[]
  onClose: () => void
  onPick: (option: ReferenceOption) => void
}

const SEARCH_DELAY_MS = 200

/** Search products, collections, entries or files and pick one. */
export default function ReferenceSearchDialog({
  open,
  kind,
  definitionId,
  title,
  selected,
  onClose,
  onPick,
}: ReferenceSearchDialogProps) {
  // Hooks
  const copy = useCopy(fieldInputContent)
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<ReferenceOption[] | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const timer = setTimeout(() => {
      api.metaobjects
        .references({ kind, query: query || undefined, definitionId })
        .then((rows) => !cancelled && setOptions(rows))
        .catch(() => !cancelled && setOptions([]))
    }, SEARCH_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, kind, query, definitionId])

  // Event handlers
  const handleOpenChange = (next: boolean) => {
    if (next) return
    setQuery('')
    setOptions(null)
    onClose()
  }

  // Render logic
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            size="lg"
            className="pl-9"
            value={query}
            placeholder={copy.search}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="-mx-2 max-h-[22rem] min-h-[8rem] overflow-y-auto">
          {options === null ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              <Spinner />
            </div>
          ) : options.length === 0 ? (
            <EmptyState
              variant="plain"
              size="lg"
              className="px-2"
              body={kind === 'file' && !query ? copy.filesEmpty : copy.noResults}
            />
          ) : (
            <ul className="flex flex-col">
              {options.map((o) => {
                const chosen = selected.includes(o.id)
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      disabled={chosen}
                      onClick={() => onPick(o)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent',
                      )}
                    >
                      <ReferenceThumb kind={kind} url={o.imageUrl} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-body-strong">{o.label}</span>
                        {o.detail ? (
                          <span className="truncate text-caption text-muted-foreground">
                            {o.detail}
                          </span>
                        ) : null}
                      </span>
                      {chosen ? <CheckIcon className="size-4 text-primary" /> : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
