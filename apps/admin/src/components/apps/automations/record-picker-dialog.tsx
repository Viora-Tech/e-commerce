'use client'

import { CheckIcon, Search } from '@commerce/ui/icons'
import { Dialog, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Input } from '@commerce/ui/shadcn/input'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useEffect, useState } from 'react'
import DialogContent from '@/components/layout/dialog-content'
import DialogHeader from '@/components/layout/dialog-header'
import EmptyState from '@/components/layout/empty-state'
import { automationEditorContent } from '@/data/automations'
import { useCopy } from '@/hooks/use-copy'
import { type RecordKind, type RecordOption, searchRecords } from '@/lib/automation-records'

type RecordPickerDialogProps = {
  open: boolean
  kind: RecordKind
  title: string
  placeholder?: string | undefined
  selected: string | null
  onClose: () => void
  onPick: (option: RecordOption) => void
}

const SEARCH_DELAY_MS = 200

/** Search the store's orders, customers, products or collections and pick one (like the media picker). */
export default function RecordPickerDialog({
  open,
  kind,
  title,
  placeholder,
  selected,
  onClose,
  onPick,
}: RecordPickerDialogProps) {
  // Hooks
  const { fields: copy } = useCopy(automationEditorContent)
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<RecordOption[] | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const timer = setTimeout(() => {
      searchRecords(kind, query)
        .then((rows) => !cancelled && setOptions(rows))
        .catch(() => !cancelled && setOptions([]))
    }, SEARCH_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, kind, query])

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
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            size="lg"
            className="pl-9"
            value={query}
            aria-label={placeholder ?? copy.searchRecords}
            placeholder={placeholder ?? copy.searchRecords}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="-mx-2 max-h-[22rem] min-h-[8rem] overflow-y-auto overscroll-contain">
          {options === null ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              <Spinner />
            </div>
          ) : options.length === 0 ? (
            <EmptyState variant="plain" size="lg" className="px-2" body={copy.noRecords} />
          ) : (
            <ul className="flex flex-col">
              {options.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => onPick(o)}
                    className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-body-strong">{o.label}</span>
                      {o.detail ? (
                        <span className="truncate text-caption text-muted-foreground">
                          {o.detail}
                        </span>
                      ) : null}
                    </span>
                    {selected === o.id ? (
                      <CheckIcon className="size-4 text-primary" aria-hidden="true" />
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
