'use client'

import type { ProductStatus } from '@commerce/core/catalog'
import { CircleAlert, Package, Save } from '@commerce/ui/icons'
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
import KitButton from '@/components/kit/kit-button'
import DataCard from '@/components/layout/data-card'
import DetailLayout from '@/components/layout/detail-layout'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import MetafieldsCard from '@/components/metaobjects/metafields-card'
import StatusLabel from '@/components/status/status-label'
import TemplateSelectCard from '@/components/themes/template-select-card'
import { productFormContent, productsListContent } from '@/data/products'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import {
  emptyForm,
  type Facets,
  formErrors,
  fromProduct,
  type LoadedProduct,
  matrixOptions,
  type OptionRow,
  type ProductFormState,
  reconcileVariants,
  snapshot,
  toWrite,
  type VariantRow,
} from './form-state'
import ProductCategoriesCard from './product-categories-card'
import ProductCollectionsCard from './product-collections-card'
import ProductFormActions from './product-form-actions'
import ProductImageCard from './product-image-card'
import ProductMainCard from './product-main-card'
import ProductMoreSection from './product-more-section'
import ProductPageActions from './product-page-actions'
import ProductPreorderSection from './product-preorder-section'
import ProductSectionNav from './product-section-nav'
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

/** Jump-nav targets in page order; pricing and inventory move into the variants table once options exist. */
const SINGLE_SECTIONS = [
  'media',
  'details',
  'pricing',
  'inventory',
  'variants',
  'shipping',
  'seo',
  'more',
] as const
const MATRIX_SECTIONS = ['media', 'details', 'variants', 'shipping', 'seo', 'more'] as const

/** Jump-nav targets land below the sticky page header instead of under it. */
const SECTION = 'scroll-mt-[calc(var(--detail-header-height,11rem)+1rem)]'

function initialForm(product: LoadedProduct | null): ProductFormState {
  return product ? fromProduct(product) : emptyForm()
}

/** Values of the colour option, for the swatch row on the categories card. */
function colourValues(options: OptionRow[]): string[] {
  const option = options.find((o) => /colou?r/i.test(o.name))
  return option ? option.values.filter((v) => v.trim()) : []
}

export default function ProductForm({ product, facets, storefrontOrigin }: ProductFormProps) {
  // Hooks
  const copy = useCopy(productFormContent)
  const listCopy = useCopy(productsListContent)
  const router = useRouter()
  const [form, setForm] = useState<ProductFormState>(() => initialForm(product))
  const [saved, setSaved] = useState(() => snapshot(initialForm(product)))
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [attempted, setAttempted] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  /* Bumped after each save so cards that load their own data (collections) refetch. */
  const [revision, setRevision] = useState(0)

  /* Browser guard: a reload or a close with edits pending asks first. */
  useEffect(() => {
    if (snapshot(form) === saved) return
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
    setForm((f) => ({
      ...f,
      options,
      variants: reconcileVariants(options, f.options, f.variants).variants,
    }))
  /* The package is one box per product, so every variant ships in it. */
  const patchPackage = (vp: Partial<VariantRow>) =>
    setForm((f) => ({ ...f, variants: f.variants.map((v) => ({ ...v, ...vp })) }))

  // Event handlers
  const handleSave = async (status?: ProductStatus) => {
    setAttempted(true)
    const next = status ? { ...form, status } : form
    const found = formErrors(copy, next)
    if (found.preorderDeposit) setMoreOpen(true)
    if (Object.keys(found).length) return
    if (status) setForm(next)
    setBusy(true)
    setServerError(null)
    try {
      const result = await api.products.save({ ...toWrite(next), id: product?.id })
      if (!result) throw new Error(copy.toasts.failed)
      const fresh = fromProduct(result)
      setForm(fresh)
      setSaved(snapshot(fresh))
      setRevision((r) => r + 1)
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
  const isDirty = snapshot(form) !== saved
  const errors = formErrors(copy, form)
  const showErrors = attempted
  const single = matrixOptions(form.options).length === 0
  const savedForm = JSON.parse(saved) as ProductFormState
  const quantityChanged = form.variants.some(
    (v, i) => v.quantity !== savedForm.variants[i]?.quantity,
  )
  const working = busy || uploading

  return (
    <DetailLayout
      stickySide
      header={
        <>
          <SaveBar
            open={Boolean(product) && isDirty}
            message={copy.saveBar.message}
            saveLabel={copy.saveBar.save}
            discardLabel={copy.saveBar.discard}
            onSave={() => void handleSave()}
            onDiscard={handleDiscard}
            saving={busy}
          />
          <PageHeader
            title={product ? product.title : copy.newTitle}
            icon={<Package aria-hidden="true" />}
            tone={form.status === 'active' ? 'success' : 'neutral'}
            badges={
              product ? <StatusLabel kind="product" value={form.status} variant="pill" /> : null
            }
            breadcrumbs={[
              { label: listCopy.title, href: '/products' },
              { label: product ? product.title : copy.newTitle },
            ]}
            actions={
              <ProductPageActions
                busy={working}
                onPublish={() => void handleSave('active')}
                onSaveDraft={() => void handleSave('draft')}
              />
            }
          />
          <ProductSectionNav
            sections={single ? SINGLE_SECTIONS : MATRIX_SECTIONS}
            onJump={(id) => id === 'more' && setMoreOpen(true)}
          />
          {serverError ? (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>{copy.toasts.failed}</AlertTitle>
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          ) : null}
        </>
      }
      main={
        <>
          <ProductMainCard
            form={form}
            variant={first}
            singleVariant={single}
            titleError={showErrors ? errors.title : undefined}
            quantityChanged={quantityChanged}
            onPatch={patch}
            onVariant={(vp) => patchVariant(0, vp)}
            onReason={(inventoryReason) => patch({ inventoryReason })}
            media={
              <ProductImageCard
                items={form.media}
                onChange={(update) => setForm((f) => ({ ...f, media: update(f.media) }))}
                onUploading={setUploading}
              />
            }
          />
          <section id="variants" className={SECTION}>
            <VariantsCard
              title={form.title}
              options={form.options}
              variants={form.variants}
              media={form.media}
              error={showErrors ? errors.variants : undefined}
              onOptions={setOptions}
              onVariant={patchVariant}
            />
          </section>
          <section id="shipping" className={SECTION}>
            <ShippingCard
              variant={first}
              singleVariant={single}
              packageError={showErrors ? errors.package : undefined}
              onChange={(vp) => patchVariant(0, vp)}
              onPackage={patchPackage}
            />
          </section>
          <section id="seo" className={SECTION}>
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
          </section>
          <ProductMoreSection open={moreOpen} onOpenChange={setMoreOpen}>
            <DataCard title={copy.preorder.heading}>
              <ProductPreorderSection
                form={form}
                depositError={showErrors ? errors.preorderDeposit : undefined}
                onPatch={patch}
              />
            </DataCard>
            <MetafieldsCard ownerType="product" ownerId={product?.id ?? null} />
            <TemplateSelectCard
              kind="product"
              value={form.templateSuffix}
              onChange={(templateSuffix) => patch({ templateSuffix })}
            />
            {product ? <StockHistoryCard productId={product.id} /> : null}
          </ProductMoreSection>
          <div className="flex flex-wrap justify-end gap-2 px-4 py-6 md:px-6">
            <KitButton
              variant="secondary"
              onClick={() => void handleSave('draft')}
              disabled={working}
            >
              <Save className="size-4" aria-hidden="true" />
              {copy.saveDraft}
            </KitButton>
            <KitButton
              variant="primary"
              onClick={() => void handleSave('active')}
              disabled={working}
            >
              {copy.publish}
            </KitButton>
          </div>
        </>
      }
      side={
        <>
          <StatusCard
            status={form.status}
            vendor={form.vendor}
            facets={facets}
            onChange={(status) => patch({ status })}
            onVendor={(vendor) => patch({ vendor })}
          />
          <ProductCategoriesCard
            categoryId={form.categoryId}
            productType={form.productType}
            tags={form.tags}
            colours={colourValues(form.options)}
            facets={facets}
            onCategoryId={(categoryId) => patch({ categoryId })}
            onProductType={(productType) => patch({ productType })}
            onTags={(tags) => patch({ tags })}
          />
          <ProductCollectionsCard productId={product?.id ?? null} revision={revision} />
          {product ? (
            <ProductFormActions
              product={product}
              busy={working}
              storefrontOrigin={storefrontOrigin}
              onDuplicate={handleDuplicate}
              onDelete={() => setConfirmDelete(true)}
            />
          ) : null}
        </>
      }
    >
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
    </DetailLayout>
  )
}
