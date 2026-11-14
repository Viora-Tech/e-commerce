'use client'

import { CheckIcon } from '@commerce/ui/icons'
import { Dialog, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useEffect, useState } from 'react'
import DialogContent from '@/components/layout/dialog-content'
import DialogHeader from '@/components/layout/dialog-header'
import EmptyState from '@/components/layout/empty-state'
import RecordCombobox from '@/components/pickers/record-combobox'
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <RecordCombobox
          list="panel"
          size="lg"
          autoFocus
          listClassName="max-h-[22rem] min-h-[8rem]"
          placeholder={copy.search}
          query={query}
          onQueryChange={setQuery}
          items={options ?? []}
          itemKey={(o) => o.id}
          isDisabled={(o) => selected.includes(o.id)}
          onPick={onPick}
          status={
            options === null ? (
              <span className="flex h-32 items-center justify-center">
                <Spinner />
              </span>
            ) : options.length === 0 ? (
              <EmptyState
                variant="plain"
                size="lg"
                className="px-2"
                body={kind === 'file' && !query ? copy.filesEmpty : copy.noResults}
              />
            ) : null
          }
          renderItem={(o) => (
            <>
              <ReferenceThumb kind={kind} url={o.imageUrl} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-body-strong">{o.label}</span>
                {o.detail ? (
                  <span className="truncate text-caption text-muted-foreground">{o.detail}</span>
                ) : null}
              </span>
              {selected.includes(o.id) ? <CheckIcon className="size-4 text-primary" /> : null}
            </>
          )}
        />
      </DialogContent>
    </Dialog>
  )
}
