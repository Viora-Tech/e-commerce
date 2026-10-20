/** SOURCE OF TRUTH: tests for ./label-documents.ts — courier PDFs joined label-first and stored under an unguessable name. */
import { MemoryStorageProvider } from '@commerce/storage'
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import type { StoreContext } from '../context'
import { saveShipmentDocuments } from './label-documents'

/** A PDF with `pages` blank pages of the given width, as base64. */
async function pdf(pages: number, width: number): Promise<string> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) doc.addPage([width, 400])
  return Buffer.from(await doc.save()).toString('base64')
}

const ctx = { storeId: 'store-1', tx: {} } as unknown as StoreContext

/** Save the documents to memory storage and read the stored PDF back. */
async function saved(documents: Parameters<typeof saveShipmentDocuments>[1]) {
  const storage = new MemoryStorageProvider({ publicBaseUrl: 'https://media.test' })
  const url = await saveShipmentDocuments(ctx, documents, storage)
  if (!url) return { url, doc: null }
  const bytes = await storage.get(url.replace('https://media.test/', ''))
  return { url, doc: await PDFDocument.load(bytes as Uint8Array) }
}

describe('saveShipmentDocuments', () => {
  it('stores one PDF in the store folder under an unguessable name and returns its address', async () => {
    const { url } = await saved([{ kind: 'label', pdfBase64: await pdf(1, 288) }])
    expect(url).toMatch(
      /^https:\/\/media\.test\/stores\/store-1\/shipping-labels\/[0-9a-f]{32}\.pdf$/,
    )
  })

  it('puts the label first, then the invoice, whatever order the courier sent them in', async () => {
    const { doc } = await saved([
      { kind: 'commercial_invoice', pdfBase64: await pdf(2, 600) },
      { kind: 'label', pdfBase64: await pdf(1, 288) },
    ])
    expect(doc?.getPages().map((p) => p.getWidth())).toEqual([288, 600, 600])
  })

  it('skips a document that is not a PDF, and stores nothing when none is printable', async () => {
    const { doc } = await saved([
      { kind: 'label', pdfBase64: await pdf(1, 288) },
      { kind: 'other', pdfBase64: Buffer.from('not a pdf').toString('base64') },
    ])
    expect(doc?.getPageCount()).toBe(1)
    expect((await saved([{ kind: 'label', pdfBase64: 'bm9wZQ==' }])).url).toBeNull()
  })
})
