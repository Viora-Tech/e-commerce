'use client'

import { productBoxOf, variantTitle } from '@commerce/core/catalog'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import SaveErrorAlert from '@/components/approvals/save-error-alert'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DataCard from '@/components/layout/data-card'
import SaveBar from '@/components/layout/save-bar'
import { leaveGuardContent } from '@/data/common'
import { productFormContent } from '@/data/product-form'
import { rupees } from '@/data/products'
import { variantPageContent } from '@/data/variant-page'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import {
  formErrors,
  fromProduct,
  type LoadedProduct,
  type MediaItem,
  type ProductFormState,
  snapshot,
  type VariantRow,
} from '../form-state'
import { saveErrorMessage } from '../save-error'
import { generateSku } from '../sku'
import VariantImagePicker from '../variant-image-picker'
import { chosenItems } from '../variant-images'
import { variantPreorderContext } from '../variant-preorder-limit'
import { useVariantMetafields } from './use-variant-metafields'
import VariantInventoryFields from './variant-inventory-fields'
import VariantList from './variant-list'
import VariantMetafieldsCard from './variant-metafields-card'
import VariantOptionsFields from './variant-options-fields'
import VariantPageHeader from './variant-page-header'
import { optionClash, variantPageWrite, withoutVariant } from './variant-page-state'
import VariantPricingFields from './variant-pricing-fields'
import VariantShippingFields from './variant-shipping-fields'

type VariantPageProps = {
  product: LoadedProduct
  variantId: string
}

/**
 * One variant on its own page, like Shopify's: the product's variants on the left, this one's
 * cards on the right, one save bar. Saving sends the product through `products.save` (the
 * product form's path) with only this variant edited, then writes its metafields.
 */
export default function VariantPage({ product, variantId }: VariantPageProps) {
  // Hooks
  const copy = useCopy(variantPageContent)
  const formCopy = useCopy(productFormContent)
  const guardCopy = useCopy(leaveGuardContent)
  const fmt = useFormat()
  const router = useRouter()
  const fields = useVariantMetafields(variantId)
  const [form, setForm] = useState<ProductFormState>(() => fromProduct(product))
  const [saved, setSaved] = useState(() => snapshot(fromProduct(product)))
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  /** The phone picker's choice, waiting on "Leave without saving?". */
  const [pendingPick, setPendingPick] = useState<string | null>(null)

  // Helpers
  const patch = (vp: Partial<VariantRow>) =>
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v) => (v.id === variantId ? { ...v, ...vp } : v)),
    }))
  /* Files uploaded for this variant join the end of the product gallery (once). */
  const addMedia = (items: MediaItem[]) =>
    setForm((f) => ({
      ...f,
      media: [...f.media, ...items.filter((i) => !f.media.some((m) => m.id === i.id))],
    }))
  const savedForm = () => JSON.parse(saved) as ProductFormState

  // Event handlers
  const handleGenerateSku = () => {
    if (!draft) return
    const taken = form.variants.filter((v) => v.id !== variantId).map((v) => v.sku)
    patch({ sku: generateSku(form.title, draft.optionValues, taken) })
  }

  const handleSave = async () => {
    const found = formErrors(formCopy, form)
    const invalid = clash ? copy.options.taken(clash) : (found.variants ?? found.package)
    if (invalid) {
      toast.error(invalid)
      return
    }
    setBusy(true)
    setServerError(null)
    try {
      if (formDirty) {
        const write = variantPageWrite(form, savedForm(), variantId)
        const result = await api.products.save({ ...write, id: product.id })
        if (!result) throw new Error(formCopy.toasts.failed)
        const fresh = fromProduct(result)
        setForm(fresh)
        setSaved(snapshot(fresh))
      }
      // The variant is saved; a field the server turns down keeps the save bar up.
      if (await fields.save()) toast.success(copy.saved)
      else toast.error(copy.metafields.failed)
      router.refresh()
    } catch (err) {
      const message = saveErrorMessage(formCopy, err)
      setServerError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  const handleDiscard = () => {
    setForm(savedForm())
    fields.reset()
    setServerError(null)
  }

  /* Deleting saves the product without this variant, as the Variants tab's bulk Delete does: the
     server archives it instead when orders reference it. Unsaved edits on this page are dropped. */
  const handleDelete = async () => {
    setBusy(true)
    try {
      const before = savedForm()
      const write = variantPageWrite(withoutVariant(before, variantId), before, variantId)
      await api.products.save({ ...write, id: product.id })
      toast.success(copy.delete.done)
      router.push(`${routes.products.detail(product.id)}?tab=variants`)
      router.refresh()
    } catch (err) {
      setServerError(saveErrorMessage(formCopy, err))
      setBusy(false)
      setConfirmDelete(false)
    }
  }

  const handlePick = (next: string) => {
    if (next === variantId) return
    if (dirty) setPendingPick(next)
    else router.push(routes.products.variant(product.id, next))
  }

  const handleLeave = () => {
    const next = pendingPick
    setPendingPick(null)
    if (next) router.push(routes.products.variant(product.id, next))
  }

  // Early returns
  const index = form.variants.findIndex((v) => v.id === variantId)
  const draft = form.variants[index]
  if (!draft) return null

  // Render logic
  const formDirty = snapshot(form) !== saved
  const dirty = formDirty || fields.dirty
  const clash = optionClash(form, variantId)
  const title = variantTitle(draft.optionValues)
  const pricePaise = rupees.toPaise(draft.price)
  const summary = [
    copy.position(fmt.number(index + 1), fmt.number(form.variants.length)),
    pricePaise == null ? copy.noPrice : fmt.money(pricePaise),
    draft.trackInventory ? copy.inStock(fmt.number(Number(draft.quantity) || 0)) : copy.unlimited,
  ].join(' · ')
  const imageUrl = chosenItems(draft.mediaIds, form.media)[0]?.url ?? form.media[0]?.url

  return (
    <div className="mx-auto flex w-full max-w-[75rem] flex-col gap-6 px-4 pt-4 pb-6 md:px-8 md:pt-5 md:pb-8">
      <SaveBar
        open={dirty}
        message={formCopy.saveBar.message}
        saveLabel={formCopy.saveBar.save}
        discardLabel={formCopy.saveBar.discard}
        onSave={() => void handleSave()}
        onDiscard={handleDiscard}
        saving={busy}
      />
      <VariantPageHeader
        productId={product.id}
        productTitle={form.title}
        status={form.status}
        title={title}
        summary={summary}
        imageUrl={imageUrl}
        busy={busy}
        dirty={dirty}
        canDelete={form.variants.length > 1}
        onSave={() => void handleSave()}
        onDelete={() => setConfirmDelete(true)}
      />
      {/* A change sent for approval shows as a calm notice, not "Save failed" (#1531). */}
      {serverError ? <SaveErrorAlert title={formCopy.toasts.failed} message={serverError} /> : null}
      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
        <aside className="lg:sticky lg:top-4">
          <VariantList
            productId={product.id}
            variants={form.variants}
            media={form.media}
            currentId={variantId}
            onPick={handlePick}
          />
        </aside>
        <div className="flex min-w-0 flex-col gap-6">
          <DataCard title={copy.options.heading}>
            <VariantOptionsFields
              options={form.options}
              draft={draft}
              clash={clash}
              onPatch={patch}
            />
          </DataCard>
          <DataCard title={copy.image.heading} subtitle={copy.image.help}>
            <VariantImagePicker
              media={form.media}
              mediaIds={draft.mediaIds}
              label={title}
              onChange={(mediaIds) => patch({ mediaIds })}
              onAddMedia={addMedia}
            />
          </DataCard>
          <DataCard title={copy.pricing.heading}>
            <VariantPricingFields draft={draft} onPatch={patch} />
          </DataCard>
          <DataCard title={copy.inventory.heading}>
            <VariantInventoryFields
              productId={product.id}
              draft={draft}
              onPatch={patch}
              onGenerateSku={handleGenerateSku}
              preorder={variantPreorderContext(form)}
            />
          </DataCard>
          <DataCard title={copy.shipping.heading}>
            <VariantShippingFields
              draft={draft}
              onPatch={patch}
              tax={form.tax}
              productBox={productBoxOf(form.variants)}
            />
          </DataCard>
          <VariantMetafieldsCard
            definitions={fields.definitions}
            values={fields.values}
            errors={fields.errors}
            onChange={fields.change}
          />
        </div>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={copy.delete.title(title)}
        body={copy.delete.body}
        confirmLabel={copy.delete.confirm}
        cancelLabel={copy.delete.cancel}
        tone="destructive"
        busy={busy}
        onConfirm={handleDelete}
      />
      <ConfirmDialog
        open={pendingPick !== null}
        onOpenChange={(open) => !open && setPendingPick(null)}
        title={guardCopy.title}
        body={guardCopy.body}
        confirmLabel={guardCopy.leave}
        cancelLabel={guardCopy.stay}
        tone="destructive"
        onConfirm={handleLeave}
      />
    </div>
  )
}
