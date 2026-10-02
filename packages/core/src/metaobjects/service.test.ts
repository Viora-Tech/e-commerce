import { collection, createDb, media, product, type StoreTx, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { referenceOptions } from './references'
import { InvalidMetaobject, type MetaobjectDefinitionWrite } from './schemas'
import {
  createDefinition,
  createDefinitionFromPreset,
  createEntry,
  createMetafieldDefinition,
  deleteDefinition,
  deleteEntries,
  deleteMetafieldDefinition,
  getDefinition,
  getMetafields,
  listDefinitions,
  listEntries,
  listMetafieldDefinitions,
  setMetafields,
  updateDefinition,
  updateEntry,
  updateMetafieldDefinition,
} from './service'
import { metafieldsFor, metaobjectByHandle, metaobjectsByType } from './storefront'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function seedStore(slug = 'w') {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  return s.id
}

async function seedProduct(storeId: string, title: string, status: 'active' | 'draft' = 'active') {
  const [p] = await owner
    .insert(product)
    .values({ storeId, title, handle: title.toLowerCase(), status })
    .returning()
  if (!p) throw new Error('seed product')
  return p.id
}

const inStore = <T>(storeId: string, fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn)

const author: MetaobjectDefinitionWrite = {
  name: 'Author',
  fields: [
    { key: 'name', name: 'Name', type: 'single_line_text', list: false, required: true },
    { key: 'bio', name: 'Bio', type: 'multi_line_text', list: false, required: false },
  ],
  storefrontAccess: true,
}

async function expectInvalid(p: Promise<unknown>, match?: RegExp) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  )
  expect(err).toBeInstanceOf(InvalidMetaobject)
  if (match) expect((err as Error).message).toMatch(match)
  return err as InvalidMetaobject
}

describe('metaobject definitions', () => {
  it('derives a unique type from the name and lists entry counts', async () => {
    const s = await seedStore()
    const a = await inStore(s, (tx) => createDefinition(tx, s, author))
    const b = await inStore(s, (tx) => createDefinition(tx, s, author))
    expect([a.type, b.type]).toEqual(['author', 'author_2'])
    await inStore(s, (tx) =>
      createEntry(tx, s, { definitionId: a.id, status: 'active', fields: { name: 'Asha' } }),
    )
    const list = await inStore(s, (tx) => listDefinitions(tx))
    expect(list.map((d) => [d.type, d.entries, d.displayNameKey])).toEqual([
      ['author', 1, 'name'],
      ['author_2', 0, 'name'],
    ])
  })

  it('rejects a taken type, bad fields and references to unknown definitions', async () => {
    const s = await seedStore()
    await inStore(s, (tx) => createDefinition(tx, s, { ...author, type: 'author' }))
    await expectInvalid(
      inStore(s, (tx) => createDefinition(tx, s, { ...author, type: 'author' })),
      /already uses the handle author/,
    )
    await expectInvalid(
      inStore(s, (tx) =>
        createDefinition(tx, s, {
          ...author,
          fields: [
            {
              key: 'x',
              name: 'X',
              type: 'metaobject_reference',
              list: false,
              required: false,
              validations: { metaobjectDefinitionId: '0199a0c0-0000-7000-8000-000000000009' },
            },
          ],
        }),
      ),
      /content type that was deleted/,
    )
  })

  it('locks the type once entries exist, and refuses to delete a referenced definition', async () => {
    const s = await seedStore()
    const a = await inStore(s, (tx) => createDefinition(tx, s, author))
    const book = await inStore(s, (tx) =>
      createDefinition(tx, s, {
        name: 'Book',
        fields: [
          { key: 'title', name: 'Title', type: 'single_line_text', list: false, required: true },
          {
            key: 'author',
            name: 'Author',
            type: 'metaobject_reference',
            list: false,
            required: false,
            validations: { metaobjectDefinitionId: a.id },
          },
        ],
        storefrontAccess: true,
      }),
    )
    expect(
      (await inStore(s, (tx) => updateDefinition(tx, a.id, { ...author, type: 'writer' }))).type,
    ).toBe('writer')
    await inStore(s, (tx) =>
      createEntry(tx, s, { definitionId: a.id, status: 'active', fields: { name: 'A' } }),
    )
    await expectInvalid(
      inStore(s, (tx) => updateDefinition(tx, a.id, { ...author, type: 'person' })),
      /cannot change/,
    )
    await expectInvalid(
      inStore(s, (tx) => deleteDefinition(tx, a.id)),
      /Book/,
    )
    await inStore(s, (tx) => deleteDefinition(tx, book.id))
    await inStore(s, (tx) => deleteDefinition(tx, a.id))
    expect(await inStore(s, (tx) => getDefinition(tx, { id: a.id }))).toBeNull()
  })
})

describe('content type presets', () => {
  it('creates a ready-made definition with a unique type, and its entries save', async () => {
    const s = await seedStore()
    const first = await inStore(s, (tx) =>
      createDefinitionFromPreset(tx, s, { preset: 'size_guide' }),
    )
    const second = await inStore(s, (tx) =>
      createDefinitionFromPreset(tx, s, { preset: 'size_guide', name: 'Kids sizes' }),
    )
    const hindi = await inStore(s, (tx) =>
      createDefinitionFromPreset(tx, s, { preset: 'size_guide', name: 'साइज़ गाइड' }),
    )
    expect([first.type, second.type, hindi.type]).toEqual([
      'size_guide',
      'kids_sizes',
      'size_guide_2',
    ])
    const def = await inStore(s, (tx) => getDefinition(tx, { id: first.id }))
    expect([def?.name, def?.displayNameKey, def?.fields.map((f) => f.key)]).toEqual([
      'Size guide',
      'title',
      ['title', 'unit', 'rows', 'how_to_measure', 'image'],
    ])
    const entry = await inStore(s, (tx) =>
      createEntry(tx, s, {
        definitionId: first.id,
        status: 'active',
        fields: { title: 'Tops', unit: 'cm', rows: [{ size: 'S', chest: '36' }, { size: 'M' }] },
      }),
    )
    expect(entry.handle).toBe('tops')
    await expectInvalid(
      inStore(s, (tx) =>
        createEntry(tx, s, {
          definitionId: first.id,
          status: 'active',
          fields: { title: 'Tops', unit: 'feet' },
        }),
      ),
      /must be picked from the choices/,
    )
  })
})

describe('entries', () => {
  it('generates unique handles from the display field and validates values', async () => {
    const s = await seedStore()
    const a = await inStore(s, (tx) => createDefinition(tx, s, author))
    const one = await inStore(s, (tx) =>
      createEntry(tx, s, { definitionId: a.id, status: 'active', fields: { name: 'Asha Rao' } }),
    )
    const two = await inStore(s, (tx) =>
      createEntry(tx, s, { definitionId: a.id, status: 'draft', fields: { name: 'Asha Rao' } }),
    )
    expect([one.handle, two.handle]).toEqual(['asha-rao', 'asha-rao-2'])
    const err = await expectInvalid(
      inStore(s, (tx) => createEntry(tx, s, { definitionId: a.id, status: 'active', fields: {} })),
    )
    expect(err.fieldErrors).toEqual({ name: 'Name is required' })

    const updated = await inStore(s, (tx) =>
      updateEntry(tx, two.id, {
        definitionId: a.id,
        handle: 'asha',
        status: 'active',
        fields: { name: 'Asha', bio: 'Writes' },
      }),
    )
    expect(updated.handle).toBe('asha')
    const page = await inStore(s, (tx) =>
      listEntries(tx, { definitionId: a.id, page: 1, perPage: 10, query: 'writes' }),
    )
    expect(page.rows.map((r) => r.displayName)).toEqual(['Asha'])
    expect(await inStore(s, (tx) => deleteEntries(tx, [one.id, two.id]))).toBe(2)
  })

  it('confirms references exist in this store and belong to the right definition', async () => {
    const a = await seedStore('a')
    const b = await seedStore('b')
    const foreignProduct = await seedProduct(b, 'Foreign')
    const localProduct = await seedProduct(a, 'Mouse')
    const [img] = await owner
      .insert(media)
      .values({ storeId: a, url: 'https://cdn/x.png' })
      .returning()
    const writer = await inStore(a, (tx) => createDefinition(tx, a, author))
    const other = await inStore(a, (tx) => createDefinition(tx, a, { ...author, name: 'Other' }))
    const otherEntry = await inStore(a, (tx) =>
      createEntry(tx, a, { definitionId: other.id, status: 'active', fields: { name: 'O' } }),
    )
    const guide = await inStore(a, (tx) =>
      createDefinition(tx, a, {
        name: 'Guide',
        fields: [
          { key: 'title', name: 'Title', type: 'single_line_text', list: false, required: true },
          {
            key: 'products',
            name: 'Products',
            type: 'product_reference',
            list: true,
            required: false,
          },
          { key: 'image', name: 'Image', type: 'file', list: false, required: false },
          {
            key: 'by',
            name: 'By',
            type: 'metaobject_reference',
            list: false,
            required: false,
            validations: { metaobjectDefinitionId: writer.id },
          },
        ],
        storefrontAccess: true,
      }),
    )
    const cross = await expectInvalid(
      inStore(a, (tx) =>
        createEntry(tx, a, {
          definitionId: guide.id,
          status: 'active',
          fields: { title: 'G', products: [localProduct, foreignProduct] },
        }),
      ),
    )
    expect(cross.fieldErrors.products).toMatch(/was deleted/)
    const wrongDef = await expectInvalid(
      inStore(a, (tx) =>
        createEntry(tx, a, {
          definitionId: guide.id,
          status: 'active',
          fields: { title: 'G', by: otherEntry.id },
        }),
      ),
    )
    expect(wrongDef.fieldErrors.by).toMatch(/different content type/)
    const ok = await inStore(a, (tx) =>
      createEntry(tx, a, {
        definitionId: guide.id,
        status: 'active',
        fields: { title: 'G', products: [localProduct], image: img?.id },
      }),
    )
    expect(ok.handle).toBe('g')
  })

  it('never shows one store another store’s definitions or entries', async () => {
    const a = await seedStore('a')
    const b = await seedStore('b')
    const def = await inStore(a, (tx) => createDefinition(tx, a, author))
    expect(await inStore(b, (tx) => listDefinitions(tx))).toEqual([])
    await expectInvalid(
      inStore(b, (tx) =>
        createEntry(tx, b, { definitionId: def.id, status: 'active', fields: { name: 'x' } }),
      ),
    )
  })

  it('offers picker options by search or by id', async () => {
    const s = await seedStore()
    const p = await seedProduct(s, 'Keyboard')
    await seedProduct(s, 'Mouse', 'draft')
    const [c] = await owner
      .insert(collection)
      .values({ storeId: s, title: 'Gear', handle: 'gear' })
      .returning()
    const def = await inStore(s, (tx) => createDefinition(tx, s, author))
    const e = await inStore(s, (tx) =>
      createEntry(tx, s, { definitionId: def.id, status: 'active', fields: { name: 'Asha' } }),
    )
    const products = await inStore(s, (tx) =>
      referenceOptions(tx, { kind: 'product', query: 'mou' }),
    )
    expect(products.map((o) => [o.label, o.detail])).toEqual([['Mouse', 'mouse (draft)']])
    expect(
      (await inStore(s, (tx) => referenceOptions(tx, { kind: 'product', ids: [p] })))[0]?.label,
    ).toBe('Keyboard')
    expect(
      (
        await inStore(s, (tx) =>
          referenceOptions(tx, { kind: 'collection', ids: [c?.id as string] }),
        )
      )[0]?.label,
    ).toBe('Gear')
    expect(
      (
        await inStore(s, (tx) =>
          referenceOptions(tx, { kind: 'metaobject', definitionId: def.id, query: 'asha' }),
        )
      )[0]?.id,
    ).toBe(e.id)
    expect(await inStore(s, (tx) => referenceOptions(tx, { kind: 'product', ids: [] }))).toEqual([])
  })
})

describe('metafields', () => {
  it('defines, sets, clears and serves product metafields with resolved references', async () => {
    const s = await seedStore()
    const p = await seedProduct(s, 'Keyboard')
    const related = await seedProduct(s, 'Keycaps')
    const hidden = await seedProduct(s, 'Prototype', 'draft')
    const def = await inStore(s, (tx) => createDefinition(tx, s, author))
    const entry = await inStore(s, (tx) =>
      createEntry(tx, s, { definitionId: def.id, status: 'active', fields: { name: 'Asha' } }),
    )
    const care = await inStore(s, (tx) =>
      createMetafieldDefinition(tx, s, {
        ownerType: 'product',
        namespace: 'custom',
        name: 'Care guide',
        type: 'multi_line_text',
        list: false,
        validations: {},
        storefrontAccess: true,
      }),
    )
    const rel = await inStore(s, (tx) =>
      createMetafieldDefinition(tx, s, {
        ownerType: 'product',
        namespace: 'custom',
        name: 'Related',
        type: 'product_reference',
        list: true,
        validations: {},
        storefrontAccess: true,
      }),
    )
    const designer = await inStore(s, (tx) =>
      createMetafieldDefinition(tx, s, {
        ownerType: 'product',
        namespace: 'custom',
        name: 'Designer',
        type: 'metaobject_reference',
        list: false,
        validations: { metaobjectDefinitionId: def.id },
        storefrontAccess: true,
      }),
    )
    const secret = await inStore(s, (tx) =>
      createMetafieldDefinition(tx, s, {
        ownerType: 'product',
        namespace: 'custom',
        name: 'Supplier',
        type: 'single_line_text',
        list: false,
        validations: {},
        storefrontAccess: false,
      }),
    )
    expect(care.key).toBe('care_guide')
    await expectInvalid(
      inStore(s, (tx) =>
        createMetafieldDefinition(tx, s, {
          ownerType: 'product',
          namespace: 'custom',
          name: 'Care guide',
          type: 'url',
          list: false,
          validations: {},
          storefrontAccess: true,
        }),
      ),
      /already defined/,
    )

    await inStore(s, (tx) =>
      setMetafields(tx, s, {
        ownerType: 'product',
        ownerId: p,
        values: {
          [care.id]: 'Wipe dry',
          [rel.id]: [related, hidden],
          [designer.id]: entry.id,
          [secret.id]: 'ACME',
        },
      }),
    )
    const admin = await inStore(s, (tx) => getMetafields(tx, 'product', p))
    expect(admin.values[care.id]).toBe('Wipe dry')
    expect(admin.definitions.find((d) => d.id === rel.id)?.values).toBe(1)

    const served = await inStore(s, (tx) => metafieldsFor({ tx }, 'product', p))
    expect(served.custom?.care_guide).toBe('Wipe dry')
    expect(served.custom?.related).toEqual([{ id: related, handle: 'keycaps', title: 'Keycaps' }])
    expect(served.custom?.designer).toMatchObject({
      id: entry.id,
      type: 'author',
      fields: { name: 'Asha' },
    })
    expect(served.custom?.supplier).toBeUndefined()

    await inStore(s, (tx) =>
      setMetafields(tx, s, { ownerType: 'product', ownerId: p, values: { [care.id]: '' } }),
    )
    expect(
      (await inStore(s, (tx) => getMetafields(tx, 'product', p))).values[care.id],
    ).toBeUndefined()

    const bad = await expectInvalid(
      inStore(s, (tx) =>
        setMetafields(tx, s, { ownerType: 'product', ownerId: p, values: { [designer.id]: p } }),
      ),
    )
    expect(bad.fieldErrors[designer.id]).toMatch(/was deleted/)
    await expectInvalid(
      inStore(s, (tx) => setMetafields(tx, s, { ownerType: 'collection', ownerId: p, values: {} })),
      /collection no longer exists/,
    )
  })

  it('keeps key and type fixed but lets name and access change, and deletes values with the definition', async () => {
    const s = await seedStore()
    const p = await seedProduct(s, 'Keyboard')
    const d = await inStore(s, (tx) =>
      createMetafieldDefinition(tx, s, {
        ownerType: 'product',
        namespace: 'custom',
        name: 'Weight',
        type: 'number_decimal',
        list: false,
        validations: { min: 0 },
        storefrontAccess: true,
      }),
    )
    const base = {
      ownerType: 'product' as const,
      namespace: 'custom',
      type: 'number_decimal' as const,
      list: false,
      validations: { min: 0 },
      storefrontAccess: false,
    }
    await expectInvalid(
      inStore(s, (tx) => updateMetafieldDefinition(tx, d.id, { ...base, name: 'W', type: 'url' })),
      /cannot change/,
    )
    await inStore(s, (tx) => updateMetafieldDefinition(tx, d.id, { ...base, name: 'Weight (kg)' }))
    const bad = await expectInvalid(
      inStore(s, (tx) =>
        setMetafields(tx, s, { ownerType: 'product', ownerId: p, values: { [d.id]: -1 } }),
      ),
    )
    expect(bad.fieldErrors[d.id]).toMatch(/at least 0/)
    await inStore(s, (tx) =>
      setMetafields(tx, s, { ownerType: 'product', ownerId: p, values: { [d.id]: '1.5' } }),
    )
    const [row] = await inStore(s, (tx) => listMetafieldDefinitions(tx, 'product'))
    expect([row?.name, row?.storefrontAccess, row?.values]).toEqual(['Weight (kg)', false, 1])
    await inStore(s, (tx) => deleteMetafieldDefinition(tx, d.id))
    expect(await inStore(s, (tx) => listMetafieldDefinitions(tx, 'product'))).toEqual([])
  })
})

describe('storefront metaobjects', () => {
  it('serves active entries of visible types with references resolved one level', async () => {
    const s = await seedStore()
    const p = await seedProduct(s, 'Keyboard')
    const def = await inStore(s, (tx) =>
      createDefinition(tx, s, {
        name: 'Size guide',
        fields: [
          { key: 'title', name: 'Title', type: 'single_line_text', list: false, required: true },
          {
            key: 'product',
            name: 'Product',
            type: 'product_reference',
            list: false,
            required: false,
          },
        ],
        storefrontAccess: true,
      }),
    )
    await inStore(s, (tx) =>
      createEntry(tx, s, {
        definitionId: def.id,
        status: 'active',
        fields: { title: 'Mice', product: p },
      }),
    )
    await inStore(s, (tx) =>
      createEntry(tx, s, { definitionId: def.id, status: 'draft', fields: { title: 'Hidden' } }),
    )
    const hidden = await inStore(s, (tx) =>
      createDefinition(tx, s, { ...author, storefrontAccess: false }),
    )
    await inStore(s, (tx) =>
      createEntry(tx, s, { definitionId: hidden.id, status: 'active', fields: { name: 'x' } }),
    )

    const all = await inStore(s, (tx) => metaobjectsByType({ tx }, 'size_guide'))
    expect(all.map((e) => e.fields)).toEqual([
      { title: 'Mice', product: { id: p, handle: 'keyboard', title: 'Keyboard' } },
    ])
    expect(
      (await inStore(s, (tx) => metaobjectByHandle({ tx }, 'size_guide', 'mice')))?.fields.title,
    ).toBe('Mice')
    expect(await inStore(s, (tx) => metaobjectByHandle({ tx }, 'size_guide', 'hidden'))).toBeNull()
    expect(await inStore(s, (tx) => metaobjectsByType({ tx }, 'author'))).toEqual([])
    expect(await inStore(s, (tx) => metaobjectByHandle({ tx }, 'nope', 'x'))).toBeNull()
  })
})
