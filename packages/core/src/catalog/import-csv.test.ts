import { describe, expect, it } from 'vitest'
import { parseCsv, parseProductCsv, summariseImport } from './import-csv'

const HEADER =
  'Handle,Title,Body (HTML),Vendor,Type,Tags,Published,Option1 Name,Option1 Value,Option2 Name,Option2 Value,Variant SKU,Variant Grams,Variant Inventory Qty,Variant Price,Variant Compare At Price,Variant Barcode,Variant Taxable,Image Src,SEO Title,SEO Description'

const quote = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)

const row = (cells: Record<string, string>) => {
  const columns = HEADER.split(',')
  return columns.map((c) => quote(cells[c] ?? '')).join(',')
}

describe('parseCsv', () => {
  it('keeps commas, newlines and doubled quotes inside quoted fields', () => {
    const parsed = parseCsv('a,b\n"one, two","line\nbreak"\n"say ""hi""",z')
    expect(parsed).toEqual([
      ['a', 'b'],
      ['one, two', 'line\nbreak'],
      ['say "hi"', 'z'],
    ])
  })

  it('drops blank lines and a leading byte order mark', () => {
    expect(parseCsv('﻿a,b\n\n\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })
})

describe('parseProductCsv', () => {
  it('folds variant rows under one handle and reads product fields from the first', () => {
    const csv = [
      HEADER,
      row({
        Handle: 'tee',
        Title: 'Cotton tee',
        'Body (HTML)': '<p>Soft</p>',
        Vendor: 'Waimers',
        Type: 'Shirts',
        Tags: 'summer, cotton, summer',
        Published: 'TRUE',
        'Option1 Name': 'Size',
        'Option1 Value': 'Small',
        'Variant SKU': 'TEE-S',
        'Variant Grams': '180',
        'Variant Inventory Qty': '5',
        'Variant Price': '499.00',
        'Variant Compare At Price': '699.00',
        'Image Src': 'https://cdn/1.jpg',
        'SEO Title': 'Cotton tee',
      }),
      row({
        Handle: 'tee',
        'Option1 Value': 'Medium',
        'Variant SKU': 'TEE-M',
        'Variant Inventory Qty': '2',
        'Variant Price': '499.00',
      }),
      // Image-only row: repeats the handle and adds a gallery entry, not a variant.
      row({ Handle: 'tee', 'Image Src': 'https://cdn/2.jpg' }),
    ].join('\n')

    const parsed = parseProductCsv(csv)
    expect(parsed.issues).toEqual([])
    expect(parsed.products).toHaveLength(1)

    const product = parsed.products[0]
    expect(product).toMatchObject({
      handle: 'tee',
      title: 'Cotton tee',
      vendor: 'Waimers',
      productType: 'Shirts',
      status: 'active',
      optionNames: ['Size'],
      seoTitle: 'Cotton tee',
    })
    expect(product?.tags).toEqual(['summer', 'cotton'])
    expect(product?.imageUrls).toEqual(['https://cdn/1.jpg', 'https://cdn/2.jpg'])
    expect(product?.variants).toHaveLength(2)
    expect(product?.variants[0]).toMatchObject({
      optionValues: ['Small'],
      sku: 'TEE-S',
      pricePaise: 49900,
      mrpPaise: 69900,
      weightGrams: 180,
      onHand: 5,
      taxable: true,
      trackInventory: true,
    })
    expect(product?.variants[1]?.optionValues).toEqual(['Medium'])
  })

  it('reads Variant Requires Shipping, and leaves a blank one to the store', () => {
    const header = `${HEADER},Variant Requires Shipping`
    const csv = [
      header,
      `${row({ Handle: 'pdf', Title: 'Pattern PDF', 'Variant Price': '199' })},FALSE`,
      `${row({ Handle: 'mat', Title: 'Desk mat', 'Variant Price': '1299' })},`,
    ].join('\n')
    const parsed = parseProductCsv(csv)
    expect(parsed.ignoredColumns).toEqual([])
    expect(parsed.products.map((p) => p.variants[0]?.requiresShipping)).toEqual([false, undefined])
  })

  it('treats a Default Title row as a single variant with no options', () => {
    const csv = [
      HEADER,
      row({
        Handle: 'mat',
        Title: 'Desk mat',
        'Option1 Name': 'Title',
        'Option1 Value': 'Default Title',
        'Variant Price': '1299',
        'Variant Inventory Qty': '0',
      }),
    ].join('\n')

    const product = parseProductCsv(csv).products[0]
    expect(product?.optionNames).toEqual([])
    expect(product?.variants[0]?.optionValues).toEqual([])
    expect(product?.variants[0]?.pricePaise).toBe(129900)
  })

  it('reports rows it cannot use instead of throwing', () => {
    const csv = [
      HEADER,
      row({ Title: 'No handle', 'Variant Price': '10' }),
      row({ Handle: 'ghost', 'Variant Price': '10' }),
      row({
        Handle: 'tee',
        Title: 'Tee',
        'Option1 Name': 'Size',
        'Option1 Value': 'S',
        'Variant Price': '100',
      }),
      row({ Handle: 'tee', 'Option1 Value': 'S', 'Variant Price': '120' }),
    ].join('\n')

    const parsed = parseProductCsv(csv)
    expect(parsed.issues.map((i) => i.message)).toEqual([
      'Row has no handle',
      'First row for this handle has no title',
      'Duplicate variant S',
    ])
    expect(parsed.products).toHaveLength(1)
  })

  it('rejects a product whose variants do not fill every option', () => {
    const csv = [
      HEADER,
      row({
        Handle: 'tee',
        Title: 'Tee',
        'Option1 Name': 'Size',
        'Option1 Value': 'S',
        'Option2 Name': 'Colour',
        'Option2 Value': 'Red',
        'Variant Price': '100',
      }),
      row({ Handle: 'tee', 'Option1 Value': 'M', 'Variant Price': '100' }),
    ].join('\n')

    const parsed = parseProductCsv(csv)
    expect(parsed.products).toEqual([])
    expect(parsed.issues[0]?.message).toContain('does not fill every option')
  })

  it('names the columns it does not read', () => {
    const parsed = parseProductCsv(
      `Handle,Title,Variant Price,Google Shopping / MPN\ntee,Tee,100,X1`,
    )
    expect(parsed.ignoredColumns).toEqual(['Google Shopping / MPN'])
  })

  it('explains an empty file and a file without a handle column', () => {
    expect(parseProductCsv('').issues[0]?.message).toBe('The file is empty')
    expect(parseProductCsv('Title,Price\nTee,100').issues[0]?.message).toContain('No Handle column')
  })

  it('counts creates, updates and variants for the dry run', () => {
    const csv = [
      HEADER,
      row({
        Handle: 'tee',
        Title: 'Tee',
        'Variant Price': '100',
        'Image Src': 'https://cdn/1.jpg',
      }),
      row({ Handle: 'mat', Title: 'Mat', 'Variant Price': '200' }),
    ].join('\n')

    expect(summariseImport(parseProductCsv(csv), ['tee'])).toEqual({
      total: 2,
      created: 1,
      updated: 1,
      variants: 2,
      images: 1,
      issues: 0,
    })
  })
})
