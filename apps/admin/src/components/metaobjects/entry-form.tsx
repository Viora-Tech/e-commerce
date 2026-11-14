'use client'

import { type FieldDefinition, validateFields } from '@commerce/core/metaobjects'
import { Copy, Save, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import { FieldGroup } from '@commerce/ui/shadcn/field'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import PageHeader from '@/components/layout/page-header'
import ProoflyDetailPage from '@/components/layout/proofly-detail-page'
import SaveBar from '@/components/layout/save-bar'
import { entryFormContent, entryListContent } from '@/data/metaobjects'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import EntrySideCards from './entry-side-cards'
import FieldInput from './field-input'
import {
  type EntryFormState,
  entriesPath,
  entryForm,
  fieldErrorsOf,
  type LoadedDefinition,
  type LoadedEntry,
} from './form-state'

type EntryFormProps = {
  definition: LoadedDefinition
  entry: LoadedEntry | null
  title: string | null
}

/**
 * Create or edit one entry of a content type: an input per field (stacked, one column on phones),
 * its status and handle. The save bar shows once something changes; saved ones can be duplicated.
 */
export default function EntryForm({ definition, entry, title }: EntryFormProps) {
  // Hooks
  const copy = useCopy(entryFormContent)
  const listCopy = useCopy(entryListContent)
  const router = useRouter()
  const [form, setForm] = useState<EntryFormState>(() => entryForm(entry))
  const [saved, setSaved] = useState(() => JSON.stringify(entryForm(entry)))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Helpers
  const setField = (key: string, value: unknown) => {
    setForm((f) => ({ ...f, fields: { ...f.fields, [key]: value } }))
    setErrors((e) => {
      const { [key]: _gone, ...rest } = e
      return rest
    })
  }

  // Event handlers
  const handleSave = async () => {
    const local = validateFields(fields, form.fields).fieldErrors
    if (Object.keys(local).length) {
      setErrors(local)
      toast.error(copy.fixErrors)
      return
    }
    setBusy(true)
    const write = {
      definitionId: definition.id,
      status: form.status,
      fields: form.fields,
      ...(form.handle.trim() ? { handle: form.handle.trim() } : {}),
    }
    try {
      if (entry) {
        const { handle } = await api.metaobjects.updateEntry({ id: entry.id, write })
        const next = { ...form, handle }
        setForm(next)
        setSaved(JSON.stringify(next))
        toast.success(copy.saved)
        router.refresh()
      } else {
        const { id } = await api.metaobjects.createEntry(write)
        setSaved(JSON.stringify(form))
        toast.success(copy.created)
        router.replace(`${entriesPath(definition.type)}/${id}`)
      }
    } catch (err) {
      setErrors(fieldErrorsOf(err))
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleDuplicate = async () => {
    if (!entry) return
    setBusy(true)
    try {
      /* The saved version, as a draft; the server derives a fresh unique handle. */
      const { id } = await api.metaobjects.createEntry({
        definitionId: definition.id,
        status: 'draft',
        fields: entry.fields,
      })
      toast.success(copy.duplicated)
      router.push(`${entriesPath(definition.type)}/${id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!entry) return
    setConfirmDelete(false)
    setBusy(true)
    try {
      await api.metaobjects.deleteEntries({ ids: [entry.id] })
      toast.success(copy.deleted)
      router.push(entriesPath(definition.type))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
      setBusy(false)
    }
  }

  // Render logic
  const fields = definition.fields as FieldDefinition[]
  const dirty = JSON.stringify(form) !== saved

  return (
    <ProoflyDetailPage
      header={
        <PageHeader
          title={title ?? copy.newTitle(definition.name)}
          back={{ label: definition.name, href: entriesPath(definition.type) }}
          actions={
            entry ? (
              <>
                <Button variant="outline" onClick={handleDuplicate} disabled={busy}>
                  <Copy />
                  {copy.duplicate}
                </Button>
                <Button variant="outline" onClick={() => setConfirmDelete(true)} disabled={busy}>
                  <Trash2 aria-hidden="true" />
                  {copy.delete}
                </Button>
              </>
            ) : (
              <Button className="max-sm:hidden" onClick={handleSave} disabled={busy}>
                <Save aria-hidden="true" />
                {busy ? copy.saving : copy.save}
              </Button>
            )
          }
        />
      }
      main={
        <Card size="form">
          <CardContent>
            <FieldGroup>
              {fields.map((f) => (
                <FieldInput
                  key={f.key}
                  rule={f}
                  value={form.fields[f.key]}
                  error={errors[f.key]}
                  onChange={(value) => setField(f.key, value)}
                />
              ))}
            </FieldGroup>
          </CardContent>
        </Card>
      }
      side={
        <EntrySideCards
          status={form.status}
          handle={form.handle}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        />
      }
    >
      <SaveBar
        open={dirty}
        message={copy.unsaved}
        saveLabel={busy ? copy.saving : copy.save}
        discardLabel={copy.discard}
        onSave={handleSave}
        onDiscard={() => {
          setForm(JSON.parse(saved) as EntryFormState)
          setErrors({})
        }}
        saving={busy}
      />
      <ConfirmDialog
        tone="destructive"
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={listCopy.bulk.confirmTitle(1)}
        body={listCopy.bulk.confirmBody}
        confirmLabel={listCopy.bulk.confirm}
        cancelLabel={listCopy.bulk.cancel}
        busy={busy}
        onConfirm={() => void handleDelete()}
      />
    </ProoflyDetailPage>
  )
}
