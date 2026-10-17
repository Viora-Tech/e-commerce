'use client'

import { emptyCollectionRules } from '@commerce/core/collections'
import { Eye, Folder, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ActionMenu from '@/components/layout/action-menu'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import PageHeader from '@/components/layout/page-header'
import ProoflyDetailPage from '@/components/layout/proofly-detail-page'
import SaveBar from '@/components/layout/save-bar'
import MetafieldsCard from '@/components/metaobjects/metafields-card'
import OrderChip from '@/components/orders/order-chip'
import TemplateSelectCard from '@/components/themes/template-select-card'
import { collectionDetailContent, collectionFormContent } from '@/data/collections'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import CollectionImageCard from './collection-image-card'
import CollectionProductsCard from './collection-products-card'
import CollectionRulesBuilder from './collection-rules-builder'
import CollectionSeoCard from './collection-seo-card'
import CollectionTitleCard from './collection-title-card'
import CollectionTypeCard from './collection-type-card'
import CollectionVisibilityCard from './collection-visibility-card'
import {
  type CollectionFormState,
  emptyCollectionForm,
  fromCollection,
  type LoadedCollection,
  toWrite,
} from './form-state'

type CollectionFormProps = {
  collection: LoadedCollection | null
  /** Public origin of the store (`https://shop.example`), for the preview link and search listing. */
  storefrontOrigin: string
}

function initialForm(collection: LoadedCollection | null): CollectionFormState {
  return collection ? fromCollection(collection) : emptyCollectionForm()
}

function hostOf(origin: string): string {
  try {
    return new URL(origin).host
  } catch {
    return origin
  }
}

export default function CollectionForm({ collection, storefrontOrigin }: CollectionFormProps) {
  // Hooks
  const router = useRouter()
  const copy = useCopy(collectionFormContent)
  const detail = useCopy(collectionDetailContent)
  const fmt = useFormat()
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
        router.replace(routes.products.collection(id))
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
      router.push(routes.products.collections())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const dirty = JSON.stringify(form) !== saved
  const count = form.kind === 'automatic' && matches !== null ? matches : form.products.length
  const updated = collection?.updatedAt ? fmt.day(collection.updatedAt) : null
  const header = (
    <PageHeader
      title={form.title || (collection ? collection.title : detail.newTitle)}
      back={{ label: detail.back, href: routes.products.collections() }}
      lead={{
        kind: 'tile',
        node: form.imageUrl ? (
          <>
            {/* biome-ignore lint/performance/noImgElement: the collection's own image from store storage. */}
            <img src={form.imageUrl} alt="" className="size-full bg-card object-cover" />
          </>
        ) : (
          <Folder aria-hidden="true" />
        ),
      }}
      badges={
        collection ? (
          <>
            <OrderChip kind="collectionVisibility" value={form.status} />
            <OrderChip kind="collectionType" value={form.kind} />
          </>
        ) : null
      }
      summary={collection ? detail.summary(count, updated) : detail.newSummary}
      actions={
        <>
          {collection ? (
            <Button
              variant="outline"
              render={
                <a
                  href={`${storefrontOrigin}/collections/${collection.handle}`}
                  target="_blank"
                  rel="noreferrer"
                />
              }
              nativeButton={false}
            >
              <Eye aria-hidden />
              {detail.preview}
            </Button>
          ) : null}
          {collection ? (
            <ActionMenu
              label={detail.more}
              trigger="button"
              items={[
                {
                  label: copy.delete.action,
                  icon: Trash2,
                  destructive: true,
                  onSelect: () => setConfirmDelete(true),
                },
              ]}
            />
          ) : (
            /* A saved collection saves from the save bar (Figma 629:6409); a new one needs a button. */
            <Button onClick={handleSave} loading={busy}>
              {copy.save}
            </Button>
          )}
        </>
      }
    />
  )

  return (
    <ProoflyDetailPage
      header={header}
      main={
        <>
          <CollectionTitleCard title={form.title} description={form.description} onChange={patch} />
          {form.kind === 'automatic' ? (
            <CollectionRulesBuilder
              rules={form.rules}
              matches={matches}
              onChange={(rules) => patch({ rules })}
            />
          ) : null}
          <CollectionProductsCard
            kind={form.kind}
            products={form.products}
            sortOrder={form.sortOrder}
            onSortChange={(sortOrder) => patch({ sortOrder })}
            onProducts={(products) => patch({ products })}
          />
          <CollectionSeoCard
            seoTitle={form.seoTitle}
            seoDescription={form.seoDescription}
            title={form.title}
            host={hostOf(storefrontOrigin)}
            handle={collection?.handle ?? null}
            onChange={patch}
          />
          <MetafieldsCard ownerType="collection" ownerId={collection?.id ?? null} />
        </>
      }
      side={
        <>
          <CollectionVisibilityCard status={form.status} onChange={(status) => patch({ status })} />
          <CollectionTypeCard
            kind={form.kind}
            locked={collection !== null}
            onChange={(kind) =>
              patch({ kind, rules: kind === 'automatic' ? form.rules : emptyCollectionRules() })
            }
          />
          <CollectionImageCard imageUrl={form.imageUrl} onChange={patch} />
          <TemplateSelectCard
            kind="collection"
            value={form.templateSuffix}
            onChange={(templateSuffix) => patch({ templateSuffix })}
          />
        </>
      }
    >
      <SaveBar
        open={dirty && Boolean(collection)}
        message={copy.unsaved}
        saveLabel={busy ? copy.saving : copy.save}
        discardLabel={copy.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={busy}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={copy.delete.heading}
        body={copy.delete.body}
        confirmLabel={copy.delete.confirm}
        cancelLabel={copy.delete.cancel}
        onConfirm={() => void handleDelete()}
      />
    </ProoflyDetailPage>
  )
}
