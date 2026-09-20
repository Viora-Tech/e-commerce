import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { eq } from 'drizzle-orm'
import { createDb } from './client'
import {
  inventoryLevel,
  media,
  product,
  productMedia,
  productOption,
  productOptionValue,
  store,
  storeDomain,
  variant,
  variantOptionValue,
} from './schema'

type Row = {
  sku: string
  title: string
  level: 'Parent' | 'Child' | null
  parent: string | null
  color: string | null
  size: string | null
  price: number | null
  mrp: number | null
  images: string[]
  brand: string | null
  type: string | null
  hsn: string | null
  desc: string | null
  bullets: string[]
  materials: string[]
}

const handleOf = (s: string): string =>
  s
    .toLowerCase()
    .replace(/^wmr-/, '')
    .replace(/-default(-\d+)?$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const cleanTitle = (t: string): string => t.replace(/\s+-\s+NA$/, '').trim()

const paise = (n: number | null): number | null => (n == null ? null : Math.round(n * 100))

/** Dev seed: Waimers on localhost with the real catalogue. Idempotent on store slug. */
export async function seedDev(ownerUrl: string): Promise<void> {
  const db = createDb(ownerUrl)
  try {
    const [existing] = await db.select().from(store).where(eq(store.slug, 'waimers'))
    if (existing) {
      console.log('seed: waimers already present')
      return
    }
    const [s] = await db.insert(store).values({ slug: 'waimers', name: 'Waimers' }).returning()
    if (!s) throw new Error('store insert failed')
    const storeId = s.id
    await db.insert(storeDomain).values([
      { storeId, hostname: 'localhost', isPrimary: true },
      { storeId, hostname: 'waimers.localhost' },
    ])

    const rows: Row[] = JSON.parse(
      readFileSync(fileURLToPath(new URL('../seed/waimers-catalog.json', import.meta.url)), 'utf8'),
    )
    const children = new Map<string, Row[]>()
    for (const r of rows) {
      if (r.level === 'Child' && r.parent) {
        children.set(r.parent, [...(children.get(r.parent) ?? []), r])
      }
    }

    const seenHandles = new Set<string>()
    let count = 0
    for (const r of rows) {
      if (r.level === 'Child') continue
      const variants = r.level === 'Parent' ? (children.get(r.sku) ?? []) : [r]
      const sellable = variants.filter((v) => v.price != null)
      if (sellable.length === 0) continue
      let handle = handleOf(r.sku)
      if (seenHandles.has(handle)) handle = `${handle}-${count}`
      seenHandles.add(handle)

      const description = [r.desc, ...r.bullets].filter(Boolean).join('\n')
      const [p] = await db
        .insert(product)
        .values({
          storeId,
          handle,
          title: cleanTitle(r.title),
          description: description || null,
          vendor: r.brand,
          productType: r.type,
          status: 'active',
        })
        .returning()
      if (!p) throw new Error('product insert failed')

      const imageUrls = [...new Set([...r.images, ...variants.flatMap((v) => v.images)])]
      const mediaIds = new Map<string, string>()
      for (const [i, url] of imageUrls.entries()) {
        const [m] = await db
          .insert(media)
          .values({ storeId, url, alt: cleanTitle(r.title) })
          .returning()
        if (!m) throw new Error('media insert failed')
        mediaIds.set(url, m.id)
        await db
          .insert(productMedia)
          .values({ storeId, productId: p.id, mediaId: m.id, position: i })
      }

      const hasColour = r.level === 'Parent' && sellable.some((v) => v.color)
      let optionId: string | null = null
      const valueIds = new Map<string, string>()
      if (hasColour) {
        const [o] = await db
          .insert(productOption)
          .values({ storeId, productId: p.id, name: 'Colour', position: 0 })
          .returning()
        if (!o) throw new Error('option insert failed')
        optionId = o.id
      }

      for (const [i, v] of sellable.entries()) {
        const colour = hasColour ? (v.color ?? 'Default') : null
        const firstImage = v.images[0]
        const [row] = await db
          .insert(variant)
          .values({
            storeId,
            productId: p.id,
            sku: v.sku,
            title: colour ?? 'Default',
            pricePaise: paise(v.price) as number,
            mrpPaise: paise(v.mrp),
            position: i,
            mediaId: firstImage ? (mediaIds.get(firstImage) ?? null) : null,
          })
          .returning()
        if (!row) throw new Error('variant insert failed')
        await db
          .insert(inventoryLevel)
          .values({ storeId, variantId: row.id, onHand: (i * 7 + count * 3) % 11 })
        if (optionId && colour) {
          let valueId = valueIds.get(colour)
          if (!valueId) {
            const [ov] = await db
              .insert(productOptionValue)
              .values({ storeId, optionId, value: colour, position: valueIds.size })
              .returning()
            if (!ov) throw new Error('option value insert failed')
            valueId = ov.id
            valueIds.set(colour, valueId)
          }
          await db
            .insert(variantOptionValue)
            .values({ storeId, variantId: row.id, optionValueId: valueId })
        }
      }
      count += 1
    }
    console.log(`seed: waimers created (${storeId}) with ${count} products`)
  } finally {
    await db.$client.end()
  }
}

if ((import.meta as { main?: boolean }).main) {
  const url = process.env.DATABASE_URL_OWNER
  if (!url) throw new Error('DATABASE_URL_OWNER is required')
  await seedDev(url)
}
