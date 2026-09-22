'use client'

import { CircleAlert } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
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
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageBody from '@/components/layout/page-body'
import PageColumns from '@/components/layout/page-columns'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import { productFormContent, productsListContent } from '@/data/products'
import { api } from '@/lib/api-client'
import DetailsCard from './details-card'
import {
  emptyForm,
  formErrors,
  fromProduct,
  type LoadedProduct,
  type OptionRow,
  type ProductFormState,
  reconcileVariants,
  toWrite,
  type VariantRow,
} from './form-state'
import InventoryCard from './inventory-card'
import MediaCard from './media-card'
import OrganisationCard, { type Facets } from './organisation-card'
import PricingCard from './pricing-card'
import ProductFormActions from './product-form-actions'
import SeoCard from './seo-card'
import ShippingCard from './shipping-card'
import StatusCard from './status-card'
import StockHistoryCard from './stock-history-card'
import VariantsCard from './variants-card'

type ProductFormProps = {
  product: LoadedProduct | null
  facets: Facets
  storefrontOrigin: string
}

const copy = productFormContent

function initialForm(product: LoadedProduct | null): ProductFormState {
  return product ? fromProduct(product) : emptyForm()
}

export default function ProductForm({ product, facets, storefrontOrigin }: ProductFormProps) {
  // Hooks
  const router = useRouter()
  const [form, setForm] = useState<ProductFormState>(() => initialForm(product))
  const [saved, setSaved] = useState(() => JSON.stringify(initialForm(product)))
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [attempted, setAttempted] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  /* Browser guard: a reload or a close with edits pending asks first. */
  useEffect(() => {
    if (JSON.stringify(form) === saved) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [form, saved])

  // Helpers
  const patch = (p: Partial<ProductFormState>) => setForm((f) => ({ ...f, ...p }))
  const patchVariant = (index: number, vp: Partial<VariantRow>) =>
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v, i) => (i === index ? { ...v, ...vp } : v)),
    }))
  const setOptions = (options: OptionRow[]) =>
    setForm((f) => ({ ...f, options, variants: reconcileVariants(options, f.variants) }))

  // Event handlers
  const handleSave = async () => {
    setAttempted(true)
    if (Object.keys(formErrors(form)).length) return
    setBusy(true)
    setServerError(null)
    try {
      const result = await api.products.save({ ...toWrite(form), id: product?.id })
      if (!result) throw new Error(copy.toasts.failed)
      const next = fromProduct(result)
      setForm(next)
      setSaved(JSON.stringify(next))
      toast.success(product ? copy.toasts.saved : copy.toasts.created)
      if (!product) router.replace(`/products/${result.id}`)
      else router.refresh()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : copy.toasts.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleDiscard = () => {
    /* Restore the last saved snapshot, not the page prop: after a save the prop
       still holds the old product until the router refresh lands. */
    setForm(JSON.parse(saved) as ProductFormState)
    setAttempted(false)
    setServerError(null)
  }

  const handleDuplicate = async () => {
    if (!product) return
    setBusy(true)
    try {
      const { id } = await api.products.duplicate({ id: product.id })
      toast.success(copy.duplicate.toast)
      router.push(`/products/${id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.duplicate.failed)
      setBusy(false)
    }
  }

  const handleRemove = async () => {
    if (!product) return
    setBusy(true)
    try {
      const { outcome } = await api.products.delete({ id: product.id })
      toast.success(outcome === 'deleted' ? copy.toasts.deleted : copy.toasts.archived)
      router.push('/products')
      router.refresh()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : copy.toasts.failed)
      setBusy(false)
      setConfirmDelete(false)
    }
  }

  // Early returns
  const first = form.variants[0]
  if (!first) return null

  // Render logic
  const isDirty = JSON.stringify(form) !== saved
  const errors = formErrors(form)
  const showErrors = attempted
  const single = form.options.length === 0
  const savedForm = JSON.parse(saved) as ProductFormState
  const quantityChanged = form.variants.some(
    (v, i) => v.quantity !== savedForm.variants[i]?.quantity,
  )

  return (
    <PageBody width="narrow" className="kit-form">
      <SaveBar
        open={isDirty}
        message={copy.saveBar.message}
        saveLabel={copy.saveBar.save}
        discardLabel={copy.saveBar.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={busy}
      />
      <PageHeader
        title={product ? product.title : copy.newTitle}
        breadcrumbs={[
          { label: productsListContent.title, href: '/products' },
          { label: product ? product.title : copy.newTitle },
        ]}
        actions={
          <ProductFormActions
            product={product}
            busy={busy}
            dirty={isDirty}
            storefrontOrigin={storefrontOrigin}
            onDuplicate={handleDuplicate}
            onDelete={() => setConfirmDelete(true)}
            onSave={handleSave}
          />
        }
      />
      {serverError ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>{copy.toasts.failed}</AlertTitle>
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}
      <PageColumns
        main={
          <>
            <DetailsCard
              title={form.title}
              description={form.description}
              titleError={showErrors ? errors.title : undefined}
              onTitle={(title) => patch({ title })}
              onDescription={(description) => patch({ description })}
            />
            <MediaCard
              items={form.media}
              onChange={(update) => setForm((f) => ({ ...f, media: update(f.media) }))}
            />
            {single ? (
              <>
                <PricingCard variant={first} onChange={(vp) => patchVariant(0, vp)} />
                <InventoryCard
                  variant={first}
                  quantityChanged={quantityChanged}
                  reason={form.inventoryReason}
                  onChange={(vp) => patchVariant(0, vp)}
                  onReason={(inventoryReason) => patch({ inventoryReason })}
                />
              </>
            ) : null}
            <VariantsCard
              options={form.options}
              variants={form.variants}
              media={form.media}
              error={showErrors ? errors.variants : undefined}
              onOptions={setOptions}
              onVariant={patchVariant}
            />
            <ShippingCard variant={first} onChange={(vp) => patchVariant(0, vp)} />
            {product ? <StockHistoryCard productId={product.id} /> : null}
            <SeoCard
              title={form.title}
              description={form.description}
              seoTitle={form.seoTitle}
              seoDescription={form.seoDescription}
              handle={form.handle}
              storefrontOrigin={storefrontOrigin}
              onSeoTitle={(seoTitle) => patch({ seoTitle })}
              onSeoDescription={(seoDescription) => patch({ seoDescription })}
              onHandle={(handle) => patch({ handle })}
            />
          </>
        }
        side={
          <>
            <StatusCard status={form.status} onChange={(status) => patch({ status })} />
            <OrganisationCard
              productType={form.productType}
              vendor={form.vendor}
              tags={form.tags}
              facets={facets}
              onProductType={(productType) => patch({ productType })}
              onVendor={(vendor) => patch({ vendor })}
              onTags={(tags) => patch({ tags })}
            />
          </>
        }
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.delete.title(product?.title ?? '')}</AlertDialogTitle>
            <AlertDialogDescription>{copy.delete.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{copy.delete.cancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 dark:bg-destructive dark:text-destructive-foreground dark:hover:bg-destructive/90"
              onClick={handleRemove}
              disabled={busy}
            >
              {copy.delete.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageBody>
  )
}
