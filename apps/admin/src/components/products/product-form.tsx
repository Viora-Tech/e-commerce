'use client'

import type { ProductStatus } from '@commerce/core/catalog'
import { CircleAlert, Package } from '@commerce/ui/icons'
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
import DataCard from '@/components/layout/data-card'
import ProoflyDetailPage from '@/components/layout/proofly-detail-page'
import ProoflyPageHeader from '@/components/layout/proofly-page-header'
import SaveBar from '@/components/layout/save-bar'
import StatusChip from '@/components/layout/status-chip'
import MetafieldsCard from '@/components/metaobjects/metafields-card'
import TemplateSelectCard from '@/components/themes/template-select-card'
import { productFormContent } from '@/data/product-form'
import { productBannerContent, productsListContent } from '@/data/products'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { validationIssuesOf } from '@/lib/api-errors'
import { routes } from '@/lib/routes'
import AiWriterButton from './ai-writer-button'
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
import ProductBanner from './product-banner'
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
import VariantMetafieldsCard from './variant-metafields-card'
import VariantsCard from './variants-card'

type ProductFormProps = {
  product: LoadedProduct | null
  facets: Facets
  storefrontOrigin: string
  /** Show "Write with AI": AI is configured, on for the store, and the member may edit products. */
  aiWriter?: boolean
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

/** Jump-nav targets keep a little air above them when scrolled into view. */
const SECTION = 'scroll-mt-6'

function initialForm(product: LoadedProduct | null): ProductFormState {
  return product ? fromProduct(product) : emptyForm()
}

/** Values of the colour option, for the swatch row on the categories card. */
function colourValues(options: OptionRow[]): string[] {
  const option = options.find((o) => /colou?r/i.test(o.name))
  return option ? option.values.filter((v) => v.trim()) : []
}

export default function ProductForm({
  product,
  facets,
  storefrontOrigin,
  aiWriter = false,
}: ProductFormProps) {
  // Hooks
  const copy = useCopy(productFormContent)
  const listCopy = useCopy(productsListContent)
  const bannerCopy = useCopy(productBannerContent)
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
      if (!product) router.replace(routes.products.detail(result.id))
      else router.refresh()
    } catch (err) {
      const issues = validationIssuesOf(err)
      if (issues.length) {
        setServerError(
          issues
            .slice(0, 3)
            .map((i) => {
              const field =
                copy.errors.fields[i.path.split('.')[0] ?? ''] ?? copy.errors.fieldFallback
              return copy.errors.invalidField(
                field,
                i.max === undefined ? i.message : copy.errors.tooLong(i.max),
              )
            })
            .join('. '),
        )
      } else {
        setServerError(err instanceof Error ? err.message : copy.toasts.failed)
      }
    } finally {
      setBusy(false)
    }
  }

  const handleUpdateInventory = () => {
    const target = document.getElementById('inventory') ?? document.getElementById('variants')
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
      router.push(routes.products.detail(id))
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
      router.push(routes.products.list())
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
  const savedVariants = form.variants.flatMap((v) =>
    v.id ? [{ id: v.id, label: v.optionValues.join(' / ') || form.title }] : [],
  )
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
    <ProoflyDetailPage
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
          <ProoflyPageHeader
            title={product ? product.title : copy.newTitle}
            back={{ label: copy.backLabel, href: routes.products.list() }}
            tile={
              form.media[0] ? (
                <>
                  {/* biome-ignore lint/performance/noImgElement: the product's own photo from store storage. */}
                  <img src={form.media[0].url} alt="" className="size-full bg-card object-cover" />
                </>
              ) : (
                <Package aria-hidden="true" />
              )
            }
            badges={
              product ? (
                <StatusChip tone={form.status === 'draft' ? 'info' : 'neutral'}>
                  {listCopy.status[form.status]}
                </StatusChip>
              ) : null
            }
            summary={
              product
                ? bannerCopy.summary(
                    bannerCopy.state[form.status],
                    form.productType || null,
                    form.vendor || null,
                  )
                : undefined
            }
            actions={
              <ProductPageActions
                busy={working}
                live={Boolean(product) && form.status === 'active'}
                onPublish={() => void handleSave('active')}
                onSaveDraft={() => void handleSave('draft')}
              />
            }
          />
          {product ? (
            <ProductBanner
              form={form}
              onUpdateInventory={handleUpdateInventory}
              onSetStatus={() => void handleSave('active')}
            />
          ) : null}
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
            detailsAction={aiWriter ? <AiWriterButton form={form} onApply={patch} /> : undefined}
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
          {/* Extra fields stay in view, not inside "More" (#296: nobody found them there). */}
          <MetafieldsCard ownerType="product" ownerId={product?.id ?? null} />
          <VariantMetafieldsCard variants={savedVariants} />
          <ProductMoreSection open={moreOpen} onOpenChange={setMoreOpen}>
            <DataCard title={copy.preorder.heading}>
              <ProductPreorderSection
                form={form}
                depositError={showErrors ? errors.preorderDeposit : undefined}
                onPatch={patch}
              />
            </DataCard>
            <TemplateSelectCard
              kind="product"
              value={form.templateSuffix}
              onChange={(templateSuffix) => patch({ templateSuffix })}
            />
            {product ? <StockHistoryCard productId={product.id} /> : null}
          </ProductMoreSection>
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
              tone="destructive"
              onClick={handleRemove}
              disabled={busy}
            >
              {copy.delete.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ProoflyDetailPage>
  )
}
