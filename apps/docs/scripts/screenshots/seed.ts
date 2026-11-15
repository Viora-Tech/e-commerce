/**
 * Seeds the fictional "Asha Handlooms" store the docs screenshots are taken from: a handloom
 * shop in Jaipur with its own catalogue, customers, ~60 orders (the repo's demo order seed,
 * pointed at this store), draft orders, abandoned carts and Growth sessions. Nothing here is
 * real store data. Product photos are woven-stripe patterns drawn with sharp, so no real
 * catalogue images are used either.
 *
 * Runs only against a local database named `commerce_shots` (see README "Updating
 * screenshots"); it refuses anything else so it can never touch the dev, test or a deployed
 * database. Rerun safe: it empties that database and re-creates the store each time.
 *
 *   bun --env-file=../../.env scripts/screenshots/seed.ts        (from apps/docs)
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { eq, sql } from 'drizzle-orm'
import sharp from 'sharp'
import { applyThemePreset } from '../../../../packages/core/src/theme/presets'
import { defaultTheme } from '../../../../packages/core/src/theme/schema'
import { member, organization, user } from '../../../../packages/db/src/auth-schema'
import { createDb } from '../../../../packages/db/src/client'
import {
  collection,
  collectionProduct,
  inventoryLevel,
  location,
  media,
  newId,
  order,
  orderLine,
  product,
  productMedia,
  productOption,
  productOptionValue,
  store,
  storeDomain,
  variant,
  variantOptionValue,
} from '../../../../packages/db/src/schema'
import { seedDemoDrafts } from '../../../../packages/db/src/seed-demo-drafts'
import { seedDemoOrders } from '../../../../packages/db/src/seed-demo-orders'
import { theme } from '../../../../packages/db/src/theme-schema'
import { COLLECTIONS, ITEMS } from './catalogue'

/** This script's folder. */
const HERE = fileURLToPath(new URL('.', import.meta.url))

export const SHOTS_DB = 'commerce_shots'
export const STORE_SLUG = 'asha-handlooms'
export const OWNER_EMAIL = 'asha@example.in'
const ADMIN_URL = process.env.ADMIN_URL ?? 'http://localhost:3700'
/** The admin's local uploads folder (`LOCAL_UPLOAD_DIR`, relative to apps/admin). */
const UPLOADS = resolve(HERE, '../../../admin/.data/uploads')

function assertShotsDatabase(url: string | undefined): string {
  if (!url) throw new Error('DATABASE_URL_OWNER is required')
  const u = new URL(url)
  if (!['localhost', '127.0.0.1'].includes(u.hostname) || u.pathname !== `/${SHOTS_DB}`) {
    throw new Error(
      `screenshot seed only runs on localhost/${SHOTS_DB}, not ${u.host}${u.pathname}`,
    )
  }
  return url
}

/** A woven-stripe "fabric" photo in the item's colour, written to the local uploads folder. */
async function fabricPhoto(key: string, hex: string): Promise<void> {
  const stripes = Array.from({ length: 16 }, (_, i) => {
    const x = i * 50
    const tone = i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#000000' : hex
    const opacity = i % 3 === 2 ? 0 : 0.12
    return `<rect x="${x}" y="0" width="22" height="800" fill="${tone}" opacity="${opacity}"/>`
  }).join('')
  const weft = Array.from(
    { length: 40 },
    (_, i) =>
      `<rect x="0" y="${i * 20}" width="800" height="3" fill="#ffffff" opacity="${i % 2 ? 0.08 : 0.04}"/>`,
  ).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">
    <rect width="800" height="800" fill="${hex}"/>${stripes}${weft}
    <rect x="120" y="120" width="560" height="560" rx="24" fill="none" stroke="#ffffff" stroke-opacity="0.25" stroke-width="6"/>
  </svg>`
  const file = join(UPLOADS, key)
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(file, await sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer())
}

async function main(): Promise<void> {
  const url = assertShotsDatabase(process.env.DATABASE_URL_OWNER)
  const db = createDb(url)
  try {
    // Start clean. This database only ever holds this store, so empty it outright.
    await db.execute(sql`truncate table store, organization, "user" cascade`)

    const orgId = `org_${newId()}`
    const userId = `usr_${newId()}`
    await db.insert(organization).values({ id: orgId, name: 'Asha Handlooms', slug: STORE_SLUG })
    await db
      .insert(user)
      .values({ id: userId, name: 'Asha Verma', email: OWNER_EMAIL, emailVerified: true })
    await db
      .insert(member)
      .values({ id: `mem_${newId()}`, organizationId: orgId, userId, role: 'owner' })

    const [s] = await db
      .insert(store)
      .values({
        slug: STORE_SLUG,
        name: 'Asha Handlooms',
        organizationId: orgId,
        nextOrderNumber: 1001,
        contactEmail: 'hello@ashahandlooms.in',
        contactPhone: '+91 98290 41234',
        address: {
          line1: '22, Bapu Bazaar, Johari Bazar Road',
          city: 'Jaipur',
          state: 'RJ',
          pincode: '302003',
          country: 'IN',
        },
        gstin: '08ABCDE1234F1Z5',
        businessProfile: { sells: 'clothing', sellsOn: 'none' },
      })
      .returning()
    if (!s) throw new Error('store insert failed')
    const storeId = s.id
    await db.insert(storeDomain).values([
      { storeId, hostname: 'localhost', isPrimary: true },
      { storeId, hostname: `${STORE_SLUG}.localhost` },
      // The merchant's own domain, already verified, for Settings → Domains → detail.
      {
        storeId,
        hostname: 'ashahandlooms.in',
        kind: 'custom',
        status: 'active',
        sslStatus: 'active',
        routeStatus: 'ready',
        verificationToken: 'ah-7c1f42d9b8e3',
        verifiedAt: new Date(Date.now() - 3 * 86_400_000),
        lastCheckedAt: new Date(Date.now() - 20 * 60_000),
        sslCheckedAt: new Date(Date.now() - 20 * 60_000),
      },
    ])

    // Online Store → Themes: the live theme, and one unpublished preset in the library.
    const soft = applyThemePreset(defaultTheme, 'soft')
    const minimal = applyThemePreset(defaultTheme, 'minimal')
    await db.insert(theme).values([
      {
        id: newId(),
        storeId,
        name: 'Asha Handlooms',
        role: 'main',
        preset: 'soft',
        settings: soft,
        publishedAt: new Date(Date.now() - 12 * 86_400_000),
      },
      {
        id: newId(),
        storeId,
        name: 'Minimal',
        role: 'unpublished',
        preset: 'minimal',
        settings: minimal,
      },
    ])

    const [loc] = await db
      .insert(location)
      .values({
        storeId,
        name: 'Jaipur workshop',
        line1: '22, Bapu Bazaar, Johari Bazar Road',
        city: 'Jaipur',
        stateCode: 'RJ',
        pincode: '302003',
        phone: '9829041234',
        isDefault: true,
        fulfilsOnlineOrders: true,
      })
      .returning()
    if (!loc) throw new Error('location insert failed')

    const productIds = new Map<string, { id: string; type: string }>()
    for (const [n, item] of ITEMS.entries()) {
      const [p] = await db
        .insert(product)
        .values({
          storeId,
          handle: item.handle,
          title: item.title,
          description: `${item.title}, handwoven by our partner weavers in Rajasthan and Varanasi.`,
          vendor: 'Asha Handlooms',
          productType: item.type,
          tags: item.tags,
          status: 'active',
          hsCode: item.hsn,
          gstRatePercent: item.gst,
        })
        .returning()
      if (!p) throw new Error('product insert failed')
      productIds.set(item.handle, { id: p.id, type: item.type })

      const key = `shots/${item.handle}.webp`
      await fabricPhoto(key, item.colours[0]?.[1] ?? '#888888')
      const [m] = await db
        .insert(media)
        .values({
          storeId,
          url: `${ADMIN_URL}/uploads/${key}`,
          key,
          provider: 'local',
          contentType: 'image/webp',
          alt: item.title,
          width: 800,
          height: 800,
        })
        .returning()
      if (!m) throw new Error('media insert failed')
      await db.insert(productMedia).values({ storeId, productId: p.id, mediaId: m.id, position: 0 })

      // Options: Size first (when the item has sizes), then Colour; one variant per combination.
      const optionValues = new Map<string, string>()
      const colourOption: [string, string[]] = ['Colour', item.colours.map(([c]) => c)]
      const options: [string, string[]][] = item.sizes
        ? [['Size', item.sizes], colourOption]
        : [colourOption]
      for (const [position, [name, values]] of options.entries()) {
        const [o] = await db
          .insert(productOption)
          .values({ storeId, productId: p.id, name, position })
          .returning()
        if (!o) throw new Error('option insert failed')
        for (const [i, value] of values.entries()) {
          const [ov] = await db
            .insert(productOptionValue)
            .values({ storeId, optionId: o.id, value, position: i })
            .returning()
          if (ov) optionValues.set(`${name}:${value}`, ov.id)
        }
      }
      const combos = (item.sizes ?? [null]).flatMap((size) =>
        item.colours.map(([c]) => ({ colour: c, size })),
      )
      for (const [i, combo] of combos.entries()) {
        const [v] = await db
          .insert(variant)
          .values({
            storeId,
            productId: p.id,
            sku: `AH-${item.handle
              .split('-')
              .map((w) => w[0]?.toUpperCase())
              .join(
                '',
              )}-${combo.colour.slice(0, 3).toUpperCase()}${combo.size ? `-${combo.size}` : ''}`,
            title: [combo.size, combo.colour].filter(Boolean).join(' / '),
            pricePaise: item.price * 100,
            mrpPaise: item.mrp ? item.mrp * 100 : null,
            position: i,
            mediaId: m.id,
          })
          .returning()
        if (!v) throw new Error('variant insert failed')
        await db.insert(inventoryLevel).values({
          storeId,
          variantId: v.id,
          locationId: loc.id,
          onHand: 6 + ((i * 5 + n * 3) % 19),
        })
        const valueIds = [
          combo.size ? optionValues.get(`Size:${combo.size}`) : undefined,
          optionValues.get(`Colour:${combo.colour}`),
        ].filter((x): x is string => !!x)
        if (valueIds.length) {
          await db
            .insert(variantOptionValue)
            .values(valueIds.map((optionValueId) => ({ storeId, variantId: v.id, optionValueId })))
        }
      }
    }

    for (const c of COLLECTIONS) {
      const [row] = await db
        .insert(collection)
        .values({ storeId, handle: c.handle, title: c.title, kind: 'manual' })
        .returning()
      if (!row) continue
      const members = [...productIds.values()].filter((p) => c.types.includes(p.type))
      if (members.length) {
        await db.insert(collectionProduct).values(
          members.map((p, position) => ({
            storeId,
            collectionId: row.id,
            productId: p.id,
            position,
          })),
        )
      }
    }
    console.log(`shots: Asha Handlooms created with ${ITEMS.length} products`)
  } finally {
    await db.$client.end()
  }

  // Orders, customers, drafts and abandoned carts: the repo's own demo seeds, on this store.
  await seedDemoOrders(url, { storeSlug: STORE_SLUG })
  await seedDemoDrafts(url, { storeSlug: STORE_SLUG })

  // Lines get the GST rate and HSN of their product (the demo seed leaves them empty), and
  // #1042 becomes the one the order guide describes: one Kantha throw, paid, ₹2,499, same state.
  const db2 = createDb(url)
  try {
    const sid = sql`(select id from store where slug = ${STORE_SLUG})`
    // Numbers follow the order they were placed in (the demo seed numbers them at random
    // dates), whole-rupee UPI discounts, and no `demo` tags on screen.
    await db2.execute(
      sql`update "order" set number = number + 100000 where store_id = ${sid} and number < 100000`,
    )
    await db2.execute(sql`
      update "order" o set number = r.n from (
        select id, 1000 + row_number() over (order by placed_at, id) as n
        from "order" where store_id = ${sid} and number >= 100000
      ) r where o.id = r.id`)
    await db2.execute(sql`
      update "order" set payment_adjustment_paise = round(payment_adjustment_paise / 100.0) * 100,
        total_paise = subtotal_paise + round(payment_adjustment_paise / 100.0) * 100, tags = '{}'
      where store_id = ${sid}`)
    await db2.execute(sql`
      update payment p set amount_paise = o.total_paise from "order" o
      where o.id = p.order_id and o.store_id = ${sid}`)
    await db2.execute(sql`update customer set tags = '{}' where store_id = ${sid}`)
    await db2.execute(sql`
      update store set next_order_number = (select max(number) + 1 from "order" where store_id = ${sid})
      where id = ${sid}`)
    await db2.execute(sql`
      update order_line ol set gst_rate_percent = p.gst_rate_percent, hs_code = p.hs_code
      from variant v join product p on p.id = v.product_id
      where v.id = ol.variant_id and ol.store_id = (select id from store where slug = ${STORE_SLUG})`)
    const [o] = await db2
      .select()
      .from(order)
      .where(
        sql`${order.number} = 1042 and ${order.storeId} = (select id from store where slug = ${STORE_SLUG})`,
      )
    const [throwVariant] = await db2
      .select({ id: variant.id, title: variant.title })
      .from(variant)
      .innerJoin(product, eq(product.id, variant.productId))
      .where(eq(product.handle, 'kantha-stitch-throw'))
    if (o && throwVariant) {
      await db2.delete(orderLine).where(eq(orderLine.orderId, o.id))
      await db2.insert(orderLine).values({
        storeId: o.storeId,
        orderId: o.id,
        variantId: throwVariant.id,
        title: 'Kantha stitch throw',
        variantTitle: throwVariant.title,
        quantity: 1,
        fulfilledQuantity: 0,
        unitPricePaise: 249900,
        gstRatePercent: 18,
        hsCode: '6304',
      })
      await db2.execute(sql`
        update "order" set subtotal_paise = 249900, total_paise = 249900, payment_adjustment_paise = 0,
          payment_adjustment_label = null, payment_method = 'razorpay', payment_status = 'paid',
          fulfillment_status = 'unfulfilled', status = 'open', email = 'priya.sharma@example.in',
          customer_id = (select id from customer where store_id = ${o.storeId} and email = 'priya.sharma@example.in'),
          checkout_paid_at = coalesce(checkout_paid_at, placed_at), delivered_at = null,
          tax_breakdown = '{"taxPaise":38120,"cgstPaise":19060,"sgstPaise":19060,"igstPaise":0,"ratePercent":18,"interState":false}'::jsonb
        where id = ${o.id}`)
      await db2.execute(sql`
        update address set name = 'Priya Sharma', city = 'Jaipur', state_code = 'RJ', pincode = '302017'
        where id = ${o.shippingAddressId}`)
      await db2.execute(sql`
        update payment set provider = 'razorpay', status = 'captured', amount_paise = 249900,
          provider_ref = 'pay_Pq7Kx2LmR4tYb1'
        where order_id = ${o.id}`)
    }
  } finally {
    await db2.$client.end()
  }
  console.log('shots: orders, drafts and order #1042 ready')

  // Growth: 60 days of visitor sessions and order attribution (the only store in this database).
  const growth = spawnSync('bun', ['src/seed-demo-marketing.ts'], {
    cwd: resolve(HERE, '../../../../packages/db'),
    env: process.env,
    stdio: 'inherit',
  })
  if (growth.status !== 0) throw new Error('seed-demo-marketing failed')
}

await main()
