'use client'

import type { ProductStatus } from '@commerce/core/catalog'
import { CircleAlert } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { useRouter, useSearchParams } from 'next/navigation'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { ProductApp } from '@/apps/product-actions'
import type { ProductSectionProps } from '@/apps/product-sections'
import RunAutomationDialog from '@/components/automations/records/run-automation-dialog'
import { useRunAutomation } from '@/components/automations/records/use-run-automation'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DataCard from '@/components/layout/data-card'
import LeaveGuard from '@/components/layout/leave-guard'
import ProoflyDetailPage from '@/components/layout/proofly-detail-page'
import SaveBar from '@/components/layout/save-bar'
import MetafieldsCard from '@/components/metaobjects/metafields-card'
import { productFormContent } from '@/data/product-form'
import { productPageContent } from '@/data/product-page'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { ProductLayout } from '@/lib/product-layout'
import { routes } from '@/lib/routes'
import AiWriterButton from './ai-writer-button'
import DuplicateProductDialog from './duplicate-product-dialog'
import {
  emptyForm,
  type Facets,
  formErrors,
  fromProduct,
  type LoadedProduct,
  type MediaItem,
  type OptionRow,
  type ProductFormState,
  snapshot,
  toWrite,
  type VariantRow,
} from './form-state'
import ProductAppsPanel, { productAppSections } from './product-apps-panel'
import ProductBanner from './product-banner'
import { productChecklist } from './product-checklist'
import ProductHeader from './product-header'
import ProductImageCard from './product-image-card'
import ProductMainCard from './product-main-card'
import ProductPreorderSection from './product-preorder-section'
import ProductSeoPanel from './product-seo-panel'
import ProductSide from './product-side'
import { type ProductTabId, tabFromParam, tabsFor, tabsWithErrors } from './product-tab-list'
import ProductTabs from './product-tabs'
import { missingHsCode, variantTax } from './product-tax'
import { saveErrorMessage } from './save-error'
import ShippingCard from './shipping-card'
import StockHistoryCard from './stock-history-card'
import { useProductAppActions } from './use-product-app-actions'
import VariantMetafieldsCard from './variant-metafields-card'
import { matrixOptions, reconcileVariants } from './variant-reconcile'
import VariantsCard from './variants-card'

type ProductFormProps = {
  product: LoadedProduct | null
  facets: Facets
  storefrontOrigin: string
  /** Show "Write with AI": AI is configured, on for the store, and the member may edit products. */
  aiWriter?: boolean
  /** The member's choice under Account › Appearance. */
  layout?: ProductLayout
  /** Installed apps, for their sections on the More tab and their More actions. */
  apps?: readonly ProductApp[]
}

function initialForm(product: LoadedProduct | null): ProductFormState {
  return product ? fromProduct(product) : emptyForm()
}

export default function ProductForm({
  product,
  facets,
  storefrontOrigin,
  aiWriter = false,
  layout = 'tabs',
  apps = [],
}: ProductFormProps) {
  // Hooks
  const copy = useCopy(productFormContent)
  const pageCopy = useCopy(productPageContent)
  const fmt = useFormat()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [form, setForm] = useState<ProductFormState>(() => initialForm(product))
  const [saved, setSaved] = useState(() => snapshot(initialForm(product)))
  const [busy, setBusy] = useState(false)
  // The variant metafields grid's own save and whether it has edits (saved with the page, #894).
  const variantFieldsSave = useRef<(() => Promise<boolean>) | null>(null)
  const pendingCollections = useRef<string[]>([])
  const [variantFieldsDirty, setVariantFieldsDirty] = useState(false)
  const [variantFieldsReset, setVariantFieldsReset] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [attempted, setAttempted] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  /* Bumped after each save so cards that load their own data (collections) refetch. */
  const [revision, setRevision] = useState(0)
  const appItems = useProductAppActions(apps, product?.id ?? null, (tab, focus) =>
    handleOpenTab(tab, focus),
  )
  const automation = useRunAutomation(
    'product',
    apps.some((a) => a.id === 'automations'),
  )

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
  const removeVariants = (indexes: number[]) =>
    setForm((f) => {
      const left = f.variants.filter((_, i) => !indexes.includes(i))
      return left.length ? { ...f, variants: left } : f
    })
  /* Files uploaded for a variant join the end of the gallery (once). */
  const addMedia = (items: MediaItem[]) =>
    setForm((f) => ({
      ...f,
      media: [...f.media, ...items.filter((i) => !f.media.some((m) => m.id === i.id))],
    }))
  /* The package is one box per product, so every variant ships in it. */
  const patchPackage = (vp: Partial<VariantRow>) =>
    setForm((f) => ({ ...f, variants: f.variants.map((v) => ({ ...v, ...vp })) }))

  const mainCard = (tab: 'details' | 'pricing' | 'inventory') =>
    first ? (
      <ProductMainCard
        form={form}
        variant={first}
        facets={facets}
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

  /* An app's section or menu item jumps to the field it reads (GST: the HSN code). The panel
     un-hides on the next render, so focus waits a frame. */
  const handleOpenTab: ProductSectionProps['onOpenTab'] = (tab, focus) => {
    handleSelectTab(tab)
    if (focus) window.setTimeout(() => document.getElementById(focus)?.focus(), 50)
  }

  /* "No HS code" on the checklist opens the product's HSN field itself (#63), not just its tab. */
  const handleChecklistSelect = (id: string) => {
    if (id === 'shipping' && !product?.isGiftCard && missingHsCode(form.tax, form.variants)) {
      handleOpenTab('shipping', 'product-hs')
      return
    }
    handleSelectTab(id)
  }

  const handleSave = async (status?: ProductStatus) => {
    setAttempted(true)
    const next = status ? { ...form, status } : form
    const found = formErrors(copy, next)
    if (Object.keys(found).length) {
      const failing = tabsWithErrors(found, matrixOptions(next.options).length === 0)[0]
      if (failing) handleSelectTab(failing, true)
      // Said out loud too: the button pressed may be far from the field (the side column's Save).
      toast.error(copy.errors.fixBeforeSave)
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
      // Then each variant whose metafields changed; one that fails names its variant and stays
      // unsaved (the save bar stays up), the product itself is saved.
      const fieldsSaved = variantFieldsSave.current ? await variantFieldsSave.current() : true
      // Collections picked before the first save join the new product now (audit #200).
      if (!product && pendingCollections.current.length > 0) {
        await api.collections.setForProduct({
          productId: result.id,
          collectionIds: pendingCollections.current,
        })
      }
      if (fieldsSaved) toast.success(product ? copy.toasts.saved : copy.toasts.created)
      if (!product) router.replace(routes.products.detail(result.id))
      else router.refresh()
    } catch (err) {
      const message = saveErrorMessage(copy, err)
      setServerError(message)
      // The banner sits above the page; a save from the bottom of the side column never saw it.
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  const handleUpdateInventory = () => {
    handleSelectTab(single ? 'price' : 'variants')
  }

  const handleDiscard = () => {
    /* Restore the last saved snapshot, not the page prop: after a save the prop
       still holds the old product until the router refresh lands. */
    setForm(JSON.parse(saved) as ProductFormState)
    setVariantFieldsReset((n) => n + 1)
    setAttempted(false)
    setServerError(null)
  }
  const handleArchive = () => void handleSave(form.status === 'archived' ? 'draft' : 'archived')

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
  const isDirty = snapshot(form) !== saved || variantFieldsDirty
  const errors = formErrors(copy, form)
  const showErrors = attempted
  const single = matrixOptions(form.options).length === 0
  const savedForm = JSON.parse(saved) as ProductFormState
  const quantityChanged = form.variants.some(
    (v, i) => v.quantity !== savedForm.variants[i]?.quantity,
  )
  const working = busy || uploading
  const tabIds = tabsFor(single)
  const activeTab = tabFromParam(searchParams.get('tab'), single)
  const failing = new Set<ProductTabId>(showErrors ? tabsWithErrors(errors, single) : [])
  const checklist = productChecklist(
    copy,
    fmt,
    form,
    errors,
    single,
    { count: productAppSections(apps).length, copy: pageCopy.checklist },
    product?.isGiftCard === true,
  )
  const tabs = tabIds.map((id) => ({
    id,
    label: copy.tabs.labels[id],
    description: copy.tabs.descriptions[id],
    error: failing.has(id),
    count:
      id === 'overview' && form.media.length > 0
        ? fmt.number(form.media.length)
        : id === 'variants'
          ? fmt.number(form.variants.length)
          : undefined,
    warn: checklist.find((item) => item.id === id)?.state === 'warn',
  }))
  const variantsCard = (
    <>
      <VariantsCard
        title={form.title}
        options={form.options}
        variants={form.variants}
        media={form.media}
        tax={form.tax}
        preorder={form}
        facets={facets}
        error={showErrors ? errors.variants : undefined}
        onOptions={setOptions}
        onVariant={patchVariant}
        onRemoveVariants={removeVariants}
        onAddMedia={addMedia}
      />
      <VariantMetafieldsCard
        variants={savedVariants}
        variantKey={savedVariants.map((v) => v.id).join(',')}
        hasUnsaved={form.variants.some((v) => !v.id)}
        saveRef={variantFieldsSave}
        onDirtyChange={setVariantFieldsDirty}
        resetSignal={variantFieldsReset}
      />
      <DataCard title={copy.preorder.heading}>
        <ProductPreorderSection
          form={form}
          depositError={showErrors ? errors.preorderDeposit : undefined}
          onPatch={patch}
        />
      </DataCard>
      {product ? <StockHistoryCard productId={product.id} /> : null}
    </>
  )
  const panels: Partial<Record<ProductTabId, ReactNode>> = {
    overview: (
      <>
        <ProductImageCard
          items={form.media}
          onChange={(update) => setForm((f) => ({ ...f, media: update(f.media) }))}
          onUploading={setUploading}
        />
        {mainCard('details')}
        {/* Extra fields stay in view, not inside "More" (#296: nobody found them there). */}
        <MetafieldsCard ownerType="product" ownerId={product?.id ?? null} collapseEmpty />
      </>
    ),
    price: (
      <>
        {mainCard('pricing')}
        {mainCard('inventory')}
        {variantsCard}
      </>
    ),
    variants: variantsCard,
    shipping: (
      <ShippingCard
        variant={first}
        singleVariant={single}
        packageError={showErrors ? errors.package : undefined}
        tax={form.tax}
        onTax={(tax) => patch({ tax })}
        onChange={(vp) => patchVariant(0, vp)}
        onPackage={patchPackage}
      />
    ),
    seo: (
      <ProductSeoPanel
        form={form}
        productId={product?.id ?? null}
        storefrontOrigin={storefrontOrigin}
        aiWriter={aiWriter}
        onPatch={patch}
      />
    ),
    more: (
      <ProductAppsPanel
        apps={apps}
        productId={product?.id ?? null}
        title={form.title}
        variants={form.variants.map((v) => ({ ...v, ...variantTax(form.tax, v) }))}
        onOpenTab={handleOpenTab}
      />
    ),
  }

  return (
    <ProoflyDetailPage
      header={
        <>
          {/* A new product has no save bar yet; its typed title still asks before it is lost (#202). */}
          <LeaveGuard when={!product && isDirty} />
          <SaveBar
            open={Boolean(product) && isDirty}
            message={copy.saveBar.message}
            saveLabel={copy.saveBar.save}
            discardLabel={copy.saveBar.discard}
            onSave={() => void handleSave()}
            onDiscard={handleDiscard}
            saving={busy}
          />
          <ProductHeader
            product={product}
            form={form}
            single={single}
            busy={working}
            dirty={isDirty}
            storefrontOrigin={storefrontOrigin}
            onSave={() => void handleSave()}
            onDuplicate={() => setDuplicating(true)}
            onArchive={handleArchive}
            onDelete={() => setConfirmDelete(true)}
            appItems={[
              ...automation.items(product ? [product.id] : [], { runsLink: true, heading: true }),
              ...appItems,
            ]}
          />
          {product ? (
            <ProductBanner
              form={form}
              onUpdateInventory={handleUpdateInventory}
              onSetStatus={() => void handleSave('active')}
              lowStockThreshold={facets.lowStockThreshold}
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
        // Variants takes the whole width (Figma 949:8022): price, MRP, SKU and stock fit without
        // scrolling sideways. Save and status stay in the header bar.
        activeTab === 'variants' && form.variants.length > 1 ? undefined : (
          <ProductSide
            onPendingCollections={(ids) => {
              pendingCollections.current = ids
            }}
            form={form}
            facets={facets}
            productId={product?.id ?? null}
            revision={revision}
            checklist={checklist}
            activeTab={activeTab}
            busy={working}
            live={Boolean(product) && form.status === 'active'}
            onPatch={patch}
            onSelectTab={handleChecklistSelect}
            onPublish={() => void handleSave('active')}
            onSaveDraft={() => void handleSave('draft')}
          />
        )
      }
    >
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={copy.delete.title(product?.title ?? '')}
        body={copy.delete.body}
        confirmLabel={copy.delete.confirm}
        cancelLabel={copy.delete.cancel}
        busy={busy}
        onConfirm={handleRemove}
      />
      {product ? (
        <DuplicateProductDialog
          productId={product.id}
          open={duplicating}
          onOpenChange={setDuplicating}
        />
      ) : null}
      <RunAutomationDialog
        subjectType="product"
        ids={automation.target}
        onClose={automation.close}
      />
    </ProoflyDetailPage>
  )
}
