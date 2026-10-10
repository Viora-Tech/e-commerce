/** SOURCE OF TRUTH: custom data on the database — extra fields and content entries, as the Shopify importer stores them, render through an imported theme's Liquid (a mega-menu snippet, a roadmap loop, product spec fields); hidden types, drafts and other stores never show; loads stay batched. Test database only */
import {
  collection,
  createDb,
  media,
  metafield,
  metafieldDefinition,
  metaobject,
  metaobjectDefinition,
  navigationMenu,
  product,
  type StoreTx,
  store,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { buildThemeBundle } from './bundle'
import { storeLiquidData } from './data'
import { createPageContext } from './page-context'
import { renderLiquidSection } from './render'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

async function seedStore() {
  const [s] = await owner
    .insert(store)
    .values({ slug: `s${Math.random().toString(36).slice(2, 8)}`, name: 'Waimers' })
    .returning()
  if (!s) throw new Error('seed')
  return s.id
}

/** What the Shopify importer leaves behind for one store: extra fields and content entries. */
async function seedCustomData(storeId: string) {
  const [img] = await owner
    .insert(media)
    .values({
      storeId,
      url: 'https://cdn.example/menu.png',
      contentType: 'image/png',
      alt: 'Menu',
      width: 800,
      height: 640,
    })
    .returning()
  const [mouse] = await owner
    .insert(product)
    .values({ storeId, handle: 'mouse', title: 'Mouse', status: 'active' })
    .returning()
  const [pad] = await owner
    .insert(product)
    .values({ storeId, handle: 'pad', title: 'Pad', status: 'active' })
    .returning()
  const [mice] = await owner
    .insert(collection)
    .values({ storeId, handle: 'mice', title: 'Mice' })
    .returning()
  if (!img || !mouse || !pad || !mice) throw new Error('seed')
  await owner.insert(navigationMenu).values({
    storeId,
    handle: 'main-menu',
    title: 'Main menu',
    items: [
      { id: 'a', title: 'Shop', type: 'collection', value: 'mice' },
      { id: 'b', title: 'Mouse', type: 'product', value: 'mouse' },
    ],
  })
  const defs = await owner
    .insert(metafieldDefinition)
    .values([
      {
        storeId,
        ownerType: 'product',
        namespace: 'custom',
        key: 'spec_weight',
        name: 'Weight',
        type: 'single_line_text',
      },
      {
        storeId,
        ownerType: 'product',
        namespace: 'custom',
        key: 'menu_image',
        name: 'Menu image',
        type: 'file',
      },
      {
        storeId,
        ownerType: 'product',
        namespace: 'custom',
        key: 'accessories',
        name: 'Accessories',
        type: 'product_reference',
        list: true,
      },
      {
        storeId,
        ownerType: 'collection',
        namespace: 'custom',
        key: 'menu_image',
        name: 'Menu image',
        type: 'file',
      },
      {
        storeId,
        ownerType: 'product',
        namespace: 'custom',
        key: 'secret',
        name: 'Secret',
        type: 'single_line_text',
        storefrontAccess: false,
      },
    ])
    .returning()
  const def = (owner: string, key: string) => {
    const d = defs.find((x) => x.ownerType === owner && x.key === key)
    if (!d) throw new Error(key)
    return d.id
  }
  const [mega, hidden] = await owner
    .insert(metaobjectDefinition)
    .values([
      {
        storeId,
        type: 'mega_menu',
        name: 'Mega menu',
        fields: [
          { key: 'title', name: 'Title', type: 'single_line_text', list: false, required: false },
          { key: 'image', name: 'Image', type: 'file', list: false, required: false },
          {
            key: 'collection',
            name: 'Collection',
            type: 'collection_reference',
            list: false,
            required: false,
          },
        ],
      },
      {
        storeId,
        type: 'internal',
        name: 'Internal',
        storefrontAccess: false,
        fields: [
          { key: 'title', name: 'Title', type: 'single_line_text', list: false, required: false },
        ],
      },
    ])
    .returning()
  if (!mega || !hidden) throw new Error('seed')
  await owner.insert(metaobject).values([
    {
      storeId,
      definitionId: mega.id,
      handle: 'gear',
      fields: { title: 'Gear', image: img.id, collection: mice.id },
    },
    {
      storeId,
      definitionId: mega.id,
      handle: 'drafty',
      status: 'draft',
      fields: { title: 'Draft' },
    },
    { storeId, definitionId: mega.id, handle: 'support', fields: { title: 'Support' } },
    { storeId, definitionId: hidden.id, handle: 'x', fields: { title: 'Hidden' } },
  ])
  await owner.insert(metafield).values([
    {
      storeId,
      definitionId: def('product', 'spec_weight'),
      ownerType: 'product',
      ownerId: mouse.id,
      value: '58 g',
    },
    {
      storeId,
      definitionId: def('product', 'menu_image'),
      ownerType: 'product',
      ownerId: mouse.id,
      value: img.id,
    },
    {
      storeId,
      definitionId: def('product', 'accessories'),
      ownerType: 'product',
      ownerId: mouse.id,
      value: [pad.id],
    },
    {
      storeId,
      definitionId: def('product', 'secret'),
      ownerType: 'product',
      ownerId: mouse.id,
      value: 'nope',
    },
    {
      storeId,
      definitionId: def('product', 'spec_weight'),
      ownerType: 'product',
      ownerId: pad.id,
      value: '300 g',
    },
    {
      storeId,
      definitionId: def('collection', 'menu_image'),
      ownerType: 'collection',
      ownerId: mice.id,
      value: img.id,
    },
  ])
}

const MEGA_MENU = `{%- for block in linklists.main-menu.links -%}
<a>{{ block.title }} {{ shop.metafields.custom.menu_image.value | image_url }}|{{ block.object.metafields.custom.menu_image.value | image_url }}</a>
{%- endfor -%}
<ul>{%- for item in metaobjects.mega_menu.values -%}<li>{{ item.title.value }}:{{ item.system.handle }}:{{ item.image.value | image_url }}:{{ item.collection.value.title }}</li>{%- endfor -%}</ul>
<p>{{ shop.metaobjects.mega_menu['support'].title.value }}|{{ metaobjects.internal.values.size }}|{{ metaobjects.mega_menu['drafty'].title.value }}</p>
{%- for h in (1..1) -%}{%- assign p = all_products['mouse'] -%}
<s>{{ p.metafields.custom.spec_weight }}|{{ p.metafields.custom.secret }}|{% for a in p.metafields.custom.accessories.value %}{{ a.title }}={{ a.metafields.custom.spec_weight.value }}{% endfor %}</s>
{%- endfor -%}`

async function renderFor(storeId: string, source: string) {
  const bundle = buildThemeBundle({
    themeId: `db-${storeId}`,
    version: 'v1',
    textFiles: new Map([['sections/mega.liquid', source]]),
    assetChecksums: new Map(),
    settings: {},
  })
  return withStore(app, storeId, async (tx: StoreTx) => {
    const ctx = await createPageContext({
      bundle,
      data: await storeLiquidData(tx, {
        storeId,
        host: 'shop.example',
        origin: 'https://shop.example',
      }),
      request: {
        template: 'index',
        path: '/',
        host: 'shop.example',
        origin: 'https://shop.example',
        designMode: false,
        postedForm: null,
        nonce: '',
      },
      assetBase: '/theme-assets/x',
      shopifyHost: null,
      moneyFormat: null,
      paymentTypes: [],
    })
    let failure: unknown = null
    const html = await renderLiquidSection(
      ctx,
      { id: 'mega', type: 'mega', settings: {}, blocks: [], location: 'template', index: 0 },
      (err) => {
        failure = err
      },
    )
    if (failure) throw failure
    return html
  })
}

describe('extra fields and content entries in an imported theme', () => {
  it('renders a mega menu, a content type loop and product fields from our data', async () => {
    const storeId = await seedStore()
    await seedCustomData(storeId)
    const html = await renderFor(storeId, MEGA_MENU)
    // Menu titles render; the shop has no extra fields of its own, so its image is blank.
    expect(html).toContain('<a>Shop |https://cdn.example/menu.png</a>')
    expect(html).toContain('<a>Mouse |https://cdn.example/menu.png</a>')
    // Published entries in order, fields and links resolved; drafts and hidden types never show.
    expect(html).toContain(
      '<ul><li>Gear:gear:https://cdn.example/menu.png:Mice</li><li>Support:support::</li></ul>',
    )
    expect(html).toContain('<p>Support|0|</p>')
    expect(html).toContain('<s>58 g||Pad=300 g</s>')
  })

  it('never reads another store’s custom data', async () => {
    const other = await seedStore()
    await seedCustomData(other)
    const storeId = await seedStore()
    await owner
      .insert(product)
      .values({ storeId, handle: 'mouse', title: 'Mouse', status: 'active' })
    const html = await renderFor(storeId, MEGA_MENU)
    expect(html).toContain('<ul></ul>')
    expect(html).toContain('<s>||</s>')
  })
})
