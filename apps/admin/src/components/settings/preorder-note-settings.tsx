'use client'

import { PREORDER_NOTE_MAX } from '@commerce/core/preorder'
import { Save } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { paymentsSettingsContent } from '@/data/payments'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import SettingsCard from './settings-card'

/**
 * Settings › Payments › Pre-orders: the store's default pre-order note (#936), shown for every
 * pre-order product without its own. Saved on its own call, so the balance card beside it never
 * overwrites it.
 */
export default function PreorderNoteSettings() {
  // Hooks
  const { preorderNote: copy } = useCopy(paymentsSettingsContent)
  const [note, setNote] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    api.store
      .getPreorder()
      .then((s) => setNote(s.note ?? ''))
      .catch(() => toast.error(copy.saveFailed))
  }, [copy.saveFailed])

  // Event handlers
  const handleSave = async () => {
    if (note === null) return
    setSaving(true)
    try {
      const saved = await api.store.updatePreorderNote({ note: note.trim() || null })
      setNote(saved.note ?? '')
      toast.success(copy.saved)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  // Early returns
  if (note === null) return null

  return (
    <SettingsCard title={copy.heading} description={copy.intro}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="preorder-store-note">{copy.label}</FieldLabel>
          <Textarea
            id="preorder-store-note"
            rows={3}
            maxLength={PREORDER_NOTE_MAX}
            placeholder={copy.placeholder}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <FieldDescription>{copy.help}</FieldDescription>
        </Field>
        <div>
          <Button onClick={handleSave} disabled={saving}>
            <Save aria-hidden="true" />
            {copy.save}
          </Button>
        </div>
      </FieldGroup>
    </SettingsCard>
  )
}
