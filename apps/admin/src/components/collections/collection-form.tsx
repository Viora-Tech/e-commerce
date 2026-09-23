'use client'

import { emptyCollectionRules } from '@commerce/core/collections'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@commerce/ui/shadcn/alert-dialog'
import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageBody from '@/components/layout/page-body'
import PageColumns from '@/components/layout/page-columns'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import TemplateSelectCard from '@/components/themes/template-select-card'
import { collectionFormContent as copy } from '@/data/collections'
import { api } from '@/lib/api-client'
import CollectionDetailsCard from './collection-details-card'
import CollectionMembersCard from './collection-members-card'
import CollectionSeoCard from './collection-seo-card'
import CollectionStatusCard from './collection-status-card'
import {
  type CollectionFormState,
  emptyCollectionForm,
  fromCollection,
  type LoadedCollection,
  toWrite,
} from './form-state'

type CollectionFormProps = { collection: LoadedCollection | null }

function initialForm(collection: LoadedCollection | null): CollectionFormState {
  return collection ? fromCollection(collection) : emptyCollectionForm()
}

export default function CollectionForm({ collection }: CollectionFormProps) {
  // Hooks
  const router = useRouter()
  const [form, setForm] = useState<CollectionFormState>(() => initialForm(collection))
  const [saved, setSaved] = useState(() => JSON.stringify(initialForm(collection)))
  const [busy, setBusy] = useState(false)
  const [matches, setMatches] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (form.kind !== 'automatic') return
    let cancelled = false
    setMatches(null)
    const timer = setTimeout(() => {
      api.collections
        .preview({ rules: form.rules })
        .then((n) => !cancelled && setMatches(n))
        .catch(() => !cancelled && setMatches(0))
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [form.kind, form.rules])

  // Helpers
  const patch = (next: Partial<CollectionFormState>) => setForm((f) => ({ ...f, ...next }))

  // Event handlers
  const handleSave = async () => {
    if (form.title.trim() === '') {
      toast.error(copy.details.title)
      return
    }
    setBusy(true)
    try {
      if (collection) {
        await api.collections.update({ id: collection.id, write: toWrite(form) })
        setSaved(JSON.stringify(form))
        toast.success(copy.saved)
        router.refresh()
      } else {
        const { id } = await api.collections.create(toWrite(form))
        setSaved(JSON.stringify(form))
        toast.success(copy.created)
        router.replace(`/products/collections/${id}`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  const handleDiscard = () => setForm(JSON.parse(saved) as CollectionFormState)

  const handleDelete = async () => {
    if (!collection) return
    setConfirmDelete(false)
    setBusy(true)
    try {
      await api.collections.delete({ id: collection.id })
      toast.success(copy.deleted)
      router.push('/products/collections')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const dirty = JSON.stringify(form) !== saved

  return (
    <PageBody width="narrow" className="kit-form gap-4">
      <SaveBar
        open={dirty}
        message={copy.unsaved}
        saveLabel={busy ? copy.saving : copy.save}
        discardLabel={copy.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={busy}
      />
      <PageHeader
        title={collection ? copy.editTitle : copy.newTitle}
        actions={
          collection ? (
            <Button variant="outline" onClick={() => setConfirmDelete(true)} disabled={busy}>
              {copy.delete.action}
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
          <>
            <CollectionDetailsCard
              title={form.title}
              description={form.description}
              imageUrl={form.imageUrl}
              onChange={patch}
            />
            <CollectionMembersCard
              kind={form.kind}
              rules={form.rules}
              products={form.products}
              matches={matches}
              onKind={(kind) =>
                patch({ kind, rules: kind === 'automatic' ? form.rules : emptyCollectionRules() })
              }
              onRules={(rules) => patch({ rules })}
              onProducts={(products) => patch({ products })}
            />
          </>
        }
        side={
          <>
            <CollectionStatusCard
              status={form.status}
              onChange={(status) => patch({ status })}
              sortOrder={form.sortOrder}
              onSortChange={(sortOrder) => patch({ sortOrder })}
            />
            <TemplateSelectCard
              kind="collection"
              value={form.templateSuffix}
              onChange={(templateSuffix) => patch({ templateSuffix })}
            />
            <CollectionSeoCard
              seoTitle={form.seoTitle}
              seoDescription={form.seoDescription}
              onChange={patch}
            />
          </>
        }
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.delete.heading}</AlertDialogTitle>
            <AlertDialogDescription>{copy.delete.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{copy.delete.cancel}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              {copy.delete.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageBody>
  )
}
