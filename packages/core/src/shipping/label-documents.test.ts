/** SOURCE OF TRUTH: tests for ./label-documents.ts — courier PDFs joined label-first into one label document. */
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { shipmentDocumentsAsLabel } from './label-documents'

/** A PDF with `pages` blank pages of the given width, as base64. */
async function pdf(pages: number, width: number): Promise<string> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) doc.addPage([width, 400])
  return Buffer.from(await doc.save()).toString('base64')
}

/** Join the documents and parse the result back. */
async function joined(documents: Parameters<typeof shipmentDocumentsAsLabel>[0]) {
  const label = await shipmentDocumentsAsLabel(documents)
  return label ? { label, doc: await PDFDocument.load(label.body) } : { label, doc: null }
}

describe('shipmentDocumentsAsLabel', () => {
  it('returns one PDF label document', async () => {
    const { label, doc } = await joined([{ kind: 'label', pdfBase64: await pdf(1, 288) }])
    expect(label?.contentType).toBe('application/pdf')
    expect(doc?.getPageCount()).toBe(1)
  })

  it('puts the label first, then the invoice, whatever order the courier sent them in', async () => {
    const { doc } = await joined([
      { kind: 'commercial_invoice', pdfBase64: await pdf(2, 600) },
      { kind: 'label', pdfBase64: await pdf(1, 288) },
    ])
    expect(doc?.getPages().map((p) => p.getWidth())).toEqual([288, 600, 600])
  })

  it('skips a document that is not a PDF, and returns null when none is printable', async () => {
    const { doc } = await joined([
      { kind: 'label', pdfBase64: await pdf(1, 288) },
      { kind: 'other', pdfBase64: Buffer.from('not a pdf').toString('base64') },
    ])
    expect(doc?.getPageCount()).toBe(1)
    expect((await joined([{ kind: 'label', pdfBase64: 'bm9wZQ==' }])).label).toBeNull()
  })
})
