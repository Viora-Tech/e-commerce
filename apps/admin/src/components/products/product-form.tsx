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
import { useRouter, useSearchParams } from 'next/navigation'
import { type ReactNode, useEffect, useState } from 'react'
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
import type { ProductLayout } from '@/lib/product-layout'
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
import ProductPageActions from './product-page-actions'
import ProductPreorderSection from './product-preorder-section'
import { type ProductTabId, tabsFor, tabsWithErrors } from './product-tab-list'
import ProductTabs from './product-tabs'
import SearchConsoleCard from './search-console-card'
import SeoCard from './seo-card'
import SeoKeywordsCard from './seo-keywords-card'
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
  /** The member's choice under Account › Appearance. */
  layout?: ProductLayout
}

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
  layout = 'tabs',
}: ProductFormProps) {
  // Hooks
  const copy = useCopy(productFormContent)
  const listCopy = useCopy(productsListContent)
  const bannerCopy = useCopy(productBannerContent)
  const router = useRouter()
  const searchParams = useSearchParams()
  const [form, setForm] = useState<ProductFormState>(() => initialForm(product))
  const [saved, setSaved] = useState(() => snapshot(initialForm(product)))
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [attempted, setAttempted] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
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

  const mainCard = (tab: 'details' | 'pricing' | 'inventory') =>
    first ? (
      <ProductMainCard
        form={form}
        variant={first}
        tab={tab}
        titleError={showErrors ? errors.title : undefined}
        quantityChanged={quantityChanged}
        onPatch={patch}
        onVariant={(vp) => patchVariant(0, vp)}
        onReason={(inventoryReason) => patch({ inventoryReason })}
        detailsAction={aiWriter ? <AiWriterButton form={form} onApply={patch} /> : undefined}
      />
    ) : null

  // Event handlers
  /* The tab lives in the URL (?tab=pricing) so links and Back work. pushState keeps it client-side:
     Next syncs useSearchParams without re-running the server page and its fetches. */
  const handleSelectTab = (id: string, replace = false) => {
    const params = new URLSearchParams(window.location.search)
    params.set('tab', id)
    const url = `${window.location.pathname}?${params}`
    if (replace) window.history.replaceState(null, '', url)
    else window.history.pushState(null, '', url)
  }

  const handleSave = async (status?: ProductStatus) => {
    setAttempted(true)
    const next = status ? { ...form, status } : form
    const found = formErrors(copy, next)
    if (Object.keys(found).length) {
      const failing = tabsWithErrors(found, matrixOptions(next.options).length === 0)[0]
      if (failing) handleSelectTab(failing, true)
      return
    }
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
    handleSelectTab(single ? 'inventory' : 'variants')
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
  const tabIds = tabsFor(single)
  const requested = searchParams.get('tab')
  const activeTab = tabIds.find((id) => id === requested) ?? tabIds[0] ?? 'media'
  const failing = new Set<ProductTabId>(showErrors ? tabsWithErrors(errors, single) : [])
  const tabs = tabIds.map((id) => ({
    id,
    label: copy.tabs.labels[id],
    description: copy.tabs.descriptions[id],
    error: failing.has(id),
  }))
  const panels: Partial<Record<ProductTabId, ReactNode>> = {
    media: (
      <ProductImageCard
        items={form.media}
        onChange={(update) => setForm((f) => ({ ...f, media: update(f.media) }))}
        onUploading={setUploading}
      />
    ),
    details: (
      <>
        {mainCard('details')}
        {/* Extra fields stay in view, not inside "More" (#296: nobody found them there). */}
        <MetafieldsCard ownerType="product" ownerId={product?.id ?? null} />
      </>
    ),
    pricing: mainCard('pricing'),
    inventory: mainCard('inventory'),
    variants: (
      <>
        <VariantsCard
          title={form.title}
          options={form.options}
          variants={form.variants}
          media={form.media}
          error={showErrors ? errors.variants : undefined}
          onOptions={setOptions}
          onVariant={patchVariant}
        />
        <VariantMetafieldsCard variants={savedVariants} />
      </>
    ),
    shipping: (
      <ShippingCard
        variant={first}
        singleVariant={single}
        packageError={showErrors ? errors.package : undefined}
        onChange={(vp) => patchVariant(0, vp)}
        onPackage={patchPackage}
      />
    ),
    seo: (
      <>
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
        <SeoKeywordsCard
          productId={product?.id ?? null}
          form={form}
          aiOn={aiWriter}
          onChange={(seoKeywords) => patch({ seoKeywords })}
        />
        {product ? <SearchConsoleCard productId={product.id} /> : null}
      </>
    ),
    more: (
      <>
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
      </>
    ),
  }

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
        <ProductTabs
          label={copy.tabs.label}
          errorLabel={copy.tabs.errorBadge}
          layout={layout}
          tabs={tabs}
          active={activeTab}
          onSelect={handleSelectTab}
          panels={panels}
        />
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
