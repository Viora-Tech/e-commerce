'use client'

import {
  Banner,
  BlockStack,
  ContextualSaveBar,
  Layout,
  Modal,
  Page,
  Text,
  Toast,
} from '@shopify/polaris'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { productFormContent } from '@/data/products'
import { api } from '@/lib/api-client'
import { DetailsCard } from './details-card'
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
import { InventoryCard } from './inventory-card'
import { MediaCard } from './media-card'
import { PricingCard } from './pricing-card'
import { SeoCard } from './seo-card'
import { type Facets, OrganisationCard, StatusCard } from './side-cards'
import { VariantsCard } from './variants-card'

type ProductFormProps = {
  product: LoadedProduct | null
  facets: Facets
  storefrontOrigin: string
}

const copy = productFormContent

export function ProductForm({ product, facets, storefrontOrigin }: ProductFormProps) {
  const router = useRouter()
  const initial = product ? fromProduct(product) : emptyForm()
  const [form, setForm] = useState<ProductFormState>(initial)
  const [saved, setSaved] = useState(() => JSON.stringify(initial))
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [attempted, setAttempted] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const dirty = JSON.stringify(form) !== saved
  const errors = formErrors(form)
  const showErrors = attempted
  const single = form.options.length === 0
  const first = form.variants[0]
  const savedForm = JSON.parse(saved) as ProductFormState
  const quantityChanged = form.variants.some(
    (v, i) => v.quantity !== savedForm.variants[i]?.quantity,
  )

  const patch = (p: Partial<ProductFormState>) => setForm((f) => ({ ...f, ...p }))
  const patchVariant = (index: number, vp: Partial<VariantRow>) =>
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v, i) => (i === index ? { ...v, ...vp } : v)),
    }))
  const setOptions = (options: OptionRow[]) =>
    setForm((f) => ({ ...f, options, variants: reconcileVariants(options, f.variants) }))

  async function save() {
    setAttempted(true)
    if (Object.keys(errors).length) return
    setBusy(true)
    setServerError(null)
    try {
      const result = await api.products.save({ ...toWrite(form), id: product?.id })
      if (!result) throw new Error(copy.toasts.failed)
      const next = fromProduct(result)
      setForm(next)
      setSaved(JSON.stringify(next))
      setToast(product ? copy.toasts.saved : copy.toasts.created)
      if (!product) router.replace(`/products/${result.id}`)
      else router.refresh()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : copy.toasts.failed)
    } finally {
      setBusy(false)
    }
  }

  function discard() {
    setForm(initial)
    setAttempted(false)
    setServerError(null)
  }

  async function remove() {
    if (!product) return
    setBusy(true)
    try {
      const { outcome } = await api.products.delete({ id: product.id })
      setToast(outcome === 'deleted' ? copy.toasts.deleted : copy.toasts.archived)
      router.push('/products')
      router.refresh()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : copy.toasts.failed)
      setBusy(false)
      setConfirmDelete(false)
    }
  }

  if (!first) return null

  return (
    <Page
      backAction={{ content: copy.backLabel, url: '/products' }}
      title={product ? product.title : copy.newTitle}
      secondaryActions={
        product
          ? [
              {
                content: copy.preview,
                url: `${storefrontOrigin}/products/${product.handle}`,
                external: true,
              },
              {
                content: copy.delete.action,
                destructive: true,
                onAction: () => setConfirmDelete(true),
              },
            ]
          : []
      }
    >
      {dirty || !product ? (
        <ContextualSaveBar
          message={copy.saveBar.message}
          saveAction={{ onAction: save, loading: busy, content: copy.saveBar.save }}
          discardAction={{ onAction: discard, content: copy.saveBar.discard, disabled: !dirty }}
        />
      ) : null}
      {toast ? <Toast content={toast} onDismiss={() => setToast(null)} /> : null}

      <BlockStack gap="400">
        {serverError ? (
          <Banner tone="critical" title={copy.toasts.failed} onDismiss={() => setServerError(null)}>
            <Text as="p">{serverError}</Text>
          </Banner>
        ) : null}
        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              <DetailsCard
                title={form.title}
                description={form.description}
                titleError={showErrors ? errors.title : undefined}
                onTitle={(title) => patch({ title })}
                onDescription={(description) => patch({ description })}
              />
              <MediaCard images={product?.images ?? []} />
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
                error={showErrors ? errors.variants : undefined}
                onOptions={setOptions}
                onVariant={patchVariant}
              />
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
            </BlockStack>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
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
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={copy.delete.title(product?.title ?? '')}
        primaryAction={{
          content: copy.delete.confirm,
          destructive: true,
          loading: busy,
          onAction: remove,
        }}
        secondaryActions={[
          { content: copy.delete.cancel, onAction: () => setConfirmDelete(false) },
        ]}
      >
        <Modal.Section>
          <Text as="p">{copy.delete.body}</Text>
        </Modal.Section>
      </Modal>
    </Page>
  )
}
