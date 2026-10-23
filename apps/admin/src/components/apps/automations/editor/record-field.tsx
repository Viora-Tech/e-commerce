'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { useEffect, useState } from 'react'
import { automationEditorContent } from '@/data/automations'
import { useCopy } from '@/hooks/use-copy'
import { type RecordKind, recordLabel } from '@/lib/automation-records'
import RecordPickerDialog from '../record-picker-dialog'

type RecordFieldProps = {
  id: string
  kind: RecordKind
  /** The field's name, for the button and dialog title. */
  label: string
  value: string | null
  onChange: (id: string | null) => void
}

/** A chosen collection or product shown by name, with a Choose button that opens the search popup. */
export default function RecordField({ id, kind, label, value, onChange }: RecordFieldProps) {
  // Hooks
  const { fields: copy } = useCopy(automationEditorContent)
  const [picking, setPicking] = useState(false)
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    if (!value) return
    let live = true
    recordLabel(kind, value)
      .then((n) => live && setName(n))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [kind, value])

  // Render logic
  return (
    <div className="flex items-center gap-2">
      <span id={id} className="min-w-0 flex-1 truncate text-body">
        {value ? (name ?? '…') : <span className="text-muted-foreground">{copy.none}</span>}
      </span>
      <Button variant="outline" size="sm" onClick={() => setPicking(true)} aria-describedby={id}>
        {value ? copy.change : copy.choose}
      </Button>
      <RecordPickerDialog
        open={picking}
        kind={kind}
        title={copy.pick(label.toLowerCase())}
        selected={value}
        onClose={() => setPicking(false)}
        onPick={(o) => {
          setName(o.label)
          onChange(o.id)
          setPicking(false)
        }}
      />
    </div>
  )
}
