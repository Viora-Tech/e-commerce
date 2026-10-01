'use client'

import { Plus, X } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useEffect, useState } from 'react'
import { fieldInputContent } from '@/data/metaobjects'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import ReferenceSearchDialog, {
  type ReferenceKind,
  type ReferenceOption,
} from './reference-search-dialog'
import ReferenceThumb from './reference-thumb'

type ReferencePickerProps = {
  kind: ReferenceKind
  definitionId?: string | undefined
  value: string[]
  multiple: boolean
  onChange: (ids: string[]) => void
}

/** Chosen products, collections, entries or files, with a search dialog to add more. */
export default function ReferencePicker({
  kind,
  definitionId,
  value,
  multiple,
  onChange,
}: ReferencePickerProps) {
  // Hooks
  const copy = useCopy(fieldInputContent)
  const [known, setKnown] = useState<Record<string, ReferenceOption | null>>({})
  const [picking, setPicking] = useState(false)

  /* Labels for ids chosen before this page loaded; unknown ones read as missing. */
  useEffect(() => {
    const unknown = value.filter((id) => !(id in known))
    if (unknown.length === 0) return
    let cancelled = false
    api.metaobjects.references({ kind, ids: unknown }).then((rows) => {
      if (cancelled) return
      setKnown((k) => {
        const next = { ...k }
        for (const id of unknown) next[id] = rows.find((r) => r.id === id) ?? null
        return next
      })
    })
    return () => {
      cancelled = true
    }
  }, [value, known, kind])

  // Event handlers
  const handlePick = (option: ReferenceOption) => {
    setKnown((k) => ({ ...k, [option.id]: option }))
    if (multiple) onChange([...value, option.id])
    else {
      onChange([option.id])
      setPicking(false)
    }
  }

  // Render logic
  const canAdd = multiple || value.length === 0
  const pickLabel = copy.pick[kind]

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 ? (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {value.map((id) => {
            const option = known[id]
            return (
              <li key={id} className="flex items-center gap-3 px-3 py-2">
                <ReferenceThumb kind={kind} url={option?.imageUrl ?? null} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body-strong">
                    {option === undefined ? copy.loading : (option?.label ?? copy.missing)}
                  </span>
                  {option?.detail ? (
                    <span className="truncate text-caption text-muted-foreground">
                      {option.detail}
                    </span>
                  ) : null}
                </span>
                {!multiple ? (
                  <Button variant="ghost" size="sm" onClick={() => setPicking(true)}>
                    {copy.change}
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={copy.remove}
                  onClick={() => onChange(value.filter((v) => v !== id))}
                >
                  <X />
                </Button>
              </li>
            )
          })}
        </ul>
      ) : null}
      {canAdd ? (
        <Button variant="outline" className="self-start" onClick={() => setPicking(true)}>
          <Plus />
          {pickLabel}
        </Button>
      ) : null}
      <ReferenceSearchDialog
        open={picking}
        kind={kind}
        definitionId={definitionId}
        title={pickLabel}
        selected={value}
        onClose={() => setPicking(false)}
        onPick={handlePick}
      />
    </div>
  )
}
