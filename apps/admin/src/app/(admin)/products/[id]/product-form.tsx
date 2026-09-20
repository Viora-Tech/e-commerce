'use client'

import {
  BlockStack,
  Card,
  ContextualSaveBar,
  FormLayout,
  InlineGrid,
  Layout,
  Page,
  Select,
  Text,
  TextField,
  Thumbnail,
  Toast,
} from '@shopify/polaris'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { api } from '@/lib/api-client'

type Product = NonNullable<Awaited<ReturnType<typeof api.products.get>>>

const STATUS = [
  { label: 'Active', value: 'active' },
  { label: 'Draft', value: 'draft' },
  { label: 'Archived', value: 'archived' },
]

type VariantRow = {
  id: string
  title: string
  sku: string
  price: string
  mrp: string
  onHand: string
}

function toRows(p: Product): VariantRow[] {
  return p.variants.map((v) => ({
    id: v.id,
    title: v.title,
    sku: v.sku ?? '',
    price: (v.pricePaise / 100).toString(),
    mrp: v.mrpPaise != null ? (v.mrpPaise / 100).toString() : '',
    onHand: String(v.onHand ?? 0),
  }))
}

export function ProductForm({ product }: { product: Product }) {
  const router = useRouter()
  const initial = {
    title: product.title,
    handle: product.handle,
    status: product.status as string,
    vendor: product.vendor ?? '',
    productType: product.productType ?? '',
    description: product.description ?? '',
  }
  const [form, setForm] = useState(initial)
  const [variants, setVariants] = useState(() => toRows(product))
  const [saved, setSaved] = useState(() =>
    JSON.stringify({ form: initial, variants: toRows(product) }),
  )
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const dirty = JSON.stringify({ form, variants }) !== saved
  const set = (k: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [k]: value }))
  const setVariant = (i: number, k: keyof VariantRow) => (value: string) =>
    setVariants((vs) => vs.map((v, j) => (j === i ? { ...v, [k]: value } : v)))

  async function save() {
    setBusy(true)
    try {
      await api.products.update({
        id: product.id,
        title: form.title,
        handle: form.handle,
        status: form.status as 'draft' | 'active' | 'archived',
        vendor: form.vendor || null,
        productType: form.productType || null,
        description: form.description || null,
      })
      for (const v of variants) {
        await api.products.updateVariant({
          id: v.id,
          sku: v.sku || null,
          pricePaise: Math.round(Number(v.price) * 100),
          mrpPaise: v.mrp ? Math.round(Number(v.mrp) * 100) : null,
          onHand: Number(v.onHand),
        })
      }
      setSaved(JSON.stringify({ form, variants }))
      setToast('Product saved')
      router.refresh()
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  function discard() {
    setForm(initial)
    setVariants(toRows(product))
  }

  return (
    <Page
      backAction={{ content: 'Products', url: '/products' }}
      title={product.title}
      secondaryActions={[
        {
          content: 'Preview',
          url: `http://localhost:3100/products/${product.handle}`,
          external: true,
        },
      ]}
    >
      {dirty ? (
        <ContextualSaveBar
          message="Unsaved changes"
          saveAction={{ onAction: save, loading: busy }}
          discardAction={{ onAction: discard }}
        />
      ) : null}
      {toast ? <Toast content={toast} onDismiss={() => setToast(null)} /> : null}

      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Card>
              <FormLayout>
                <TextField
                  label="Title"
                  value={form.title}
                  onChange={set('title')}
                  autoComplete="off"
                />
                <TextField
                  label="Description"
                  value={form.description}
                  onChange={set('description')}
                  multiline={8}
                  autoComplete="off"
                />
              </FormLayout>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingSm">
                  Media
                </Text>
                <InlineGrid columns={{ xs: 3, md: 5 }} gap="200">
                  {product.images.map((img) => (
                    <Thumbnail key={img.id} source={img.url} alt={img.alt ?? ''} size="large" />
                  ))}
                </InlineGrid>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingSm">
                  Variants
                </Text>
                {variants.map((v, i) => (
                  <InlineGrid key={v.id} columns={{ xs: 1, md: 5 }} gap="200" alignItems="end">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      {v.title}
                    </Text>
                    <TextField
                      label="SKU"
                      labelHidden={i > 0}
                      value={v.sku}
                      onChange={setVariant(i, 'sku')}
                      autoComplete="off"
                    />
                    <TextField
                      label="Price"
                      labelHidden={i > 0}
                      prefix="₹"
                      type="number"
                      value={v.price}
                      onChange={setVariant(i, 'price')}
                      autoComplete="off"
                    />
                    <TextField
                      label="Compare-at (MRP)"
                      labelHidden={i > 0}
                      prefix="₹"
                      type="number"
                      value={v.mrp}
                      onChange={setVariant(i, 'mrp')}
                      autoComplete="off"
                    />
                    <TextField
                      label="Available"
                      labelHidden={i > 0}
                      type="number"
                      value={v.onHand}
                      onChange={setVariant(i, 'onHand')}
                      autoComplete="off"
                    />
                  </InlineGrid>
                ))}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <Card>
              <Select
                label="Status"
                options={STATUS}
                value={form.status}
                onChange={set('status')}
              />
            </Card>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingSm">
                  Product organization
                </Text>
                <TextField
                  label="Product type"
                  value={form.productType}
                  onChange={set('productType')}
                  autoComplete="off"
                />
                <TextField
                  label="Vendor"
                  value={form.vendor}
                  onChange={set('vendor')}
                  autoComplete="off"
                />
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingSm">
                  Search engine listing
                </Text>
                <TextField
                  label="URL handle"
                  prefix="/products/"
                  value={form.handle}
                  onChange={set('handle')}
                  autoComplete="off"
                />
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  )
}
