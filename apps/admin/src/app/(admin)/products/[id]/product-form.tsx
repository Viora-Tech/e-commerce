'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'

type Product = NonNullable<Awaited<ReturnType<typeof api.products.get>>>

const statuses = ['draft', 'active', 'archived'] as const

export function ProductForm({ product }: { product: Product }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    title: product.title,
    handle: product.handle,
    status: product.status,
    vendor: product.vendor ?? '',
    productType: product.productType ?? '',
    description: product.description ?? '',
  })
  const [variants, setVariants] = useState(
    product.variants.map((v) => ({
      id: v.id,
      title: v.title,
      sku: v.sku ?? '',
      price: (v.pricePaise / 100).toString(),
      mrp: v.mrpPaise != null ? (v.mrpPaise / 100).toString() : '',
      onHand: String(v.onHand ?? 0),
    })),
  )

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await api.products.update({
        id: product.id,
        title: form.title,
        handle: form.handle,
        status: form.status,
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
      toast.success('Saved')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  })

  return (
    <form onSubmit={save} className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <Link
            href="/products"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Products
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{product.title}</h1>
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" required {...field('title')} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="handle">Handle</Label>
                <Input
                  id="handle"
                  required
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  {...field('handle')}
                />
                <p className="text-xs text-muted-foreground">/products/{form.handle}</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" rows={8} {...field('description')} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Variants</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_0.7fr] gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <span>Variant</span>
                <span>SKU</span>
                <span>Price ₹</span>
                <span>MRP ₹</span>
                <span>Stock</span>
              </div>
              {variants.map((v, i) => (
                <div
                  key={v.id}
                  className="grid grid-cols-[1.5fr_1fr_1fr_1fr_0.7fr] items-center gap-2"
                >
                  <span className="text-sm">{v.title}</span>
                  {(['sku', 'price', 'mrp', 'onHand'] as const).map((k) => (
                    <Input
                      key={k}
                      aria-label={`${v.title} ${k}`}
                      inputMode={k === 'sku' ? 'text' : 'decimal'}
                      value={v[k]}
                      onChange={(e) =>
                        setVariants((vs) =>
                          vs.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)),
                        )
                      }
                    />
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Organisation</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  {...field('status')}
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="vendor">Brand</Label>
                <Input id="vendor" {...field('vendor')} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="productType">Type</Label>
                <Input id="productType" {...field('productType')} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Media</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-2">
              {product.images.map((img) => (
                // biome-ignore lint/performance/noImgElement: CDN thumbnails in a fixed grid.
                <img
                  key={img.id}
                  src={img.url}
                  alt={img.alt ?? ''}
                  className="aspect-square rounded object-cover"
                />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  )
}
