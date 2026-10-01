'use client'

import type { FieldDefinition } from '@commerce/core/metaobjects'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import PageBody from '@/components/layout/page-body'
import PageColumns from '@/components/layout/page-columns'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import { definitionFormContent } from '@/data/metaobjects'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import ConfirmDelete from './confirm-delete'
import DefinitionDetailsCard from './definition-details-card'
import DefinitionFieldsCard from './definition-fields-card'
import DefinitionSettingsCard from './definition-settings-card'
import {
  type DefinitionFormState,
  definitionForm,
  definitionWrite,
  entriesPath,
  type LoadedDefinition,
} from './form-state'

type DefinitionFormProps = {
  definition: LoadedDefinition | null
  /** Other definitions a metaobject reference field can point at. */
  targets: { id: string; name: string }[]
}

const NAMEABLE = ['single_line_text', 'number_integer', 'number_decimal']

/** Create or edit a metaobject definition: its handle, fields, display name and access. */
export default function DefinitionForm({ definition, targets }: DefinitionFormProps) {
  // Hooks
  const copy = useCopy(definitionFormContent)
  const router = useRouter()
  const [form, setForm] = useState<DefinitionFormState>(() => definitionForm(definition))
  const [saved, setSaved] = useState(() => JSON.stringify(definitionForm(definition)))
  const [typeEdited, setTypeEdited] = useState(Boolean(definition))
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Helpers
  const patch = (next: Partial<DefinitionFormState>) => setForm((f) => ({ ...f, ...next }))

  // Event handlers
  const handleFields = (fields: FieldDefinition[]) => {
    /* The first nameable field becomes the display name, as Shopify does. */
    const first = fields.find((f) => !f.list && NAMEABLE.includes(f.type))
    const displayNameKey =
      form.fields.length === 0 && form.displayNameKey === null
        ? (first?.key ?? null)
        : form.displayNameKey
    patch({ fields, displayNameKey })
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error(copy.nameRequired)
      return
    }
    setBusy(true)
    try {
      if (definition) {
        const { type } = await api.metaobjects.updateDefinition({
          id: definition.id,
          write: definitionWrite(form),
        })
        setSaved(JSON.stringify({ ...form, type }))
        toast.success(copy.saved)
        if (type !== definition.type) router.replace(`${entriesPath(type)}/definition`)
        else router.refresh()
      } else {
        /* A type derived from the name is made unique by the server; a typed one must be free. */
        const { type: _derived, ...rest } = definitionWrite(form)
        const { type } = await api.metaobjects.createDefinition(
          typeEdited ? definitionWrite(form) : rest,
        )
        setSaved(JSON.stringify(form))
        toast.success(copy.created)
        router.replace(entriesPath(type))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!definition) return
    setConfirmDelete(false)
    setBusy(true)
    try {
      await api.metaobjects.deleteDefinition({ id: definition.id })
      toast.success(copy.delete.done)
      router.push('/content/metaobjects')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
      setBusy(false)
    }
  }

  // Render logic
  const dirty = JSON.stringify(form) !== saved
  const title = definition ? definition.name : copy.newTitle

  return (
    <PageBody width="narrow" className="kit-form gap-4">
      <SaveBar
        open={dirty}
        message={copy.unsaved}
        saveLabel={busy ? copy.saving : copy.save}
        discardLabel={copy.discard}
        onSave={handleSave}
        onDiscard={() => setForm(JSON.parse(saved) as DefinitionFormState)}
        saving={busy}
      />
      <PageHeader
        title={title}
        breadcrumbs={[
          { label: copy.back, href: '/content/metaobjects' },
          ...(definition ? [{ label: definition.name, href: entriesPath(definition.type) }] : []),
        ]}
        actions={
          definition ? (
            <>
              <Button
                variant="outline"
                render={<Link href={entriesPath(definition.type)} />}
                nativeButton={false}
              >
                {copy.viewEntries}
              </Button>
              <Button variant="outline" onClick={() => setConfirmDelete(true)} disabled={busy}>
                {copy.delete.action}
              </Button>
            </>
          ) : (
            <Button onClick={handleSave} disabled={busy}>
              {busy ? copy.saving : copy.save}
            </Button>
          )
        }
      />
      <PageColumns
        main={
          <>
            <DefinitionDetailsCard
              name={form.name}
              type={form.type}
              description={form.description}
              typeLocked={(definition?.entries ?? 0) > 0}
              followName={!typeEdited}
              onChange={patch}
              onTypeEdited={() => setTypeEdited(true)}
            />
            <DefinitionFieldsCard fields={form.fields} targets={targets} onChange={handleFields} />
          </>
        }
        side={
          <DefinitionSettingsCard
            fields={form.fields}
            displayNameKey={form.displayNameKey}
            storefrontAccess={form.storefrontAccess}
            onChange={patch}
          />
        }
      />
      <ConfirmDelete
        open={confirmDelete}
        busy={busy}
        title={copy.delete.title(definition?.name ?? '')}
        body={copy.delete.body(definition?.entries ?? 0)}
        confirm={copy.delete.confirm}
        cancel={copy.delete.cancel}
        onOpenChange={setConfirmDelete}
        onConfirm={handleDelete}
      />
    </PageBody>
  )
}
