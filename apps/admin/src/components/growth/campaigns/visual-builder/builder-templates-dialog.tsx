'use client'

import { Save, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import type { Editor } from 'grapesjs'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { emailBuilderContent } from '@/data/email-builder'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { loadDesign, readDesign } from './grapes-config'

type BuilderTemplatesDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The live editor; read when the merchant saves or loads, never during render. */
  getEditor: () => Editor | null
}

type Row = Awaited<ReturnType<typeof api.marketing.emailTemplates.list>>[number]

/** Save the canvas as a store template, start from one, or delete one. */
export default function BuilderTemplatesDialog({
  open,
  onOpenChange,
  getEditor,
}: BuilderTemplatesDialogProps) {
  // Hooks
  const { templates: t, builder } = useCopy(emailBuilderContent)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [replacing, setReplacing] = useState<Row | null>(null)

  useEffect(() => {
    if (!open) return
    let live = true
    api.marketing.emailTemplates.list().then((r) => {
      if (live) setRows(r)
    })
    return () => {
      live = false
    }
  }, [open])

  // Helpers
  const refresh = async () => setRows(await api.marketing.emailTemplates.list())

  // Event handlers
  const handleSave = async () => {
    const editor = getEditor()
    const design = editor ? readDesign(editor) : null
    if (!design) {
      toast.error(builder.compileFailed)
      return
    }
    setBusy(true)
    try {
      await api.marketing.emailTemplates.create({ name: name.trim(), design })
      toast.success(t.saved)
      setName('')
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const handleUse = async () => {
    const editor = getEditor()
    if (!replacing || !editor) return
    const row = await api.marketing.emailTemplates.get({ id: replacing.id })
    if (row) loadDesign(editor, row.design)
    setReplacing(null)
    onOpenChange(false)
  }

  const handleDelete = async (id: string) => {
    await api.marketing.emailTemplates.delete({ id })
    toast.success(t.deleted)
    await refresh()
  }

  // Render logic
  const canSave = !busy && name.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.menu}</DialogTitle>
          <DialogDescription>{t.nameBody}</DialogDescription>
        </DialogHeader>
        <div className="flex items-end gap-2">
          <Field className="flex-1">
            <FieldLabel htmlFor="email-template-name">{t.nameLabel}</FieldLabel>
            <Input
              id="email-template-name"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Button onClick={handleSave} disabled={!canSave}>
            <Save aria-hidden="true" />
            {t.nameSave}
          </Button>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-body-strong">{t.load}</p>
          {rows && rows.length === 0 ? (
            <p className="text-body text-muted-foreground">{t.empty}</p>
          ) : null}
          <ul className="flex max-h-72 flex-col overflow-y-auto">
            {(rows ?? []).map((r) => (
              <li key={r.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setReplacing(r)}
                  className="min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-body hover:bg-muted"
                >
                  {r.name}
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t.delete(r.name)}
                  onClick={() => void handleDelete(r.id)}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
      <ConfirmDialog
        open={replacing !== null}
        onOpenChange={(o) => !o && setReplacing(null)}
        title={t.replaceTitle}
        body={t.replaceBody}
        confirmLabel={t.replaceConfirm}
        cancelLabel={t.replaceCancel}
        onConfirm={handleUse}
      />
    </Dialog>
  )
}
