'use client'

import { type FieldDefinition, validateFields } from '@commerce/core/metaobjects'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import { FieldGroup } from '@commerce/ui/shadcn/field'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import PageBody from '@/components/layout/page-body'
import PageColumns from '@/components/layout/page-columns'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import { entryFormContent as copy, entryListContent } from '@/data/metaobjects'
import { api } from '@/lib/api-client'
import ConfirmDelete from './confirm-delete'
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

/** Create or edit one metaobject entry: an input per field, its status and handle. */
export default function EntryForm({ definition, entry, title }: EntryFormProps) {
  // Hooks
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
    <PageBody width="narrow" className="kit-form gap-4">
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
      <PageHeader
        title={title ?? copy.newTitle(definition.name)}
        breadcrumbs={[
          { label: entryListContent.back, href: '/content/metaobjects' },
          { label: definition.name, href: entriesPath(definition.type) },
        ]}
        actions={
          entry ? (
            <Button variant="outline" onClick={() => setConfirmDelete(true)} disabled={busy}>
              {copy.delete}
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={busy}>
              {busy ? copy.saving : copy.save}
            </Button>
          )
        }
      />
      <PageColumns
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
      />
      <ConfirmDelete
        open={confirmDelete}
        busy={busy}
        title={entryListContent.bulk.confirmTitle(1)}
        body={entryListContent.bulk.confirmBody}
        confirm={entryListContent.bulk.confirm}
        cancel={entryListContent.bulk.cancel}
        onOpenChange={setConfirmDelete}
        onConfirm={handleDelete}
      />
    </PageBody>
  )
}
