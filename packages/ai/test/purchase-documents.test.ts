import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import { generateStructured } from '../src/engine'
import { mockModel } from '../src/mock'
import { aiModel } from '../src/provider'
import { MOCK_DOCUMENTS } from '../src/purchase-documents/fixtures'
import {
  documentReaderContent,
  documentReaderInstructions,
  pdfText,
} from '../src/purchase-documents/prompt'
import { DOCUMENT_SCHEMAS, DOCUMENT_SHAPES, parseExtracted } from '../src/purchase-documents/schema'
import { textModel, textPdf } from '../src/testing'

const runtime = {
  storeId: 'store-a',
  userId: 'user-1',
  plan: 'starter',
  feature: 'documentReader',
} as const

describe('purchase document schemas', () => {
  it.each(DOCUMENT_SHAPES)('the %s fixture fits its schema and round-trips', (shape) => {
    const data = DOCUMENT_SCHEMAS[shape].parse(MOCK_DOCUMENTS[shape])
    expect(parseExtracted({ shape, data })).toEqual({ shape, data })
  })

  it('refuses an unknown shape or data that no longer fits', () => {
    expect(parseExtracted({ shape: 'receipt', data: {} })).toBeNull()
    expect(parseExtracted({ shape: 'service_bill', data: { payee: 'x' } })).toBeNull()
    expect(parseExtracted(null)).toBeNull()
  })

  it('reads a Bill of Entry answer with nulls and confidences', async () => {
    const answer = {
      ...(MOCK_DOCUMENTS.bill_of_entry as object),
      port: { value: null, confidence: 0 },
    }
    const { output } = await generateStructured({
      runtime,
      model: textModel(JSON.stringify(answer)),
      schema: DOCUMENT_SCHEMAS.bill_of_entry,
      instructions: documentReaderInstructions('bill_of_entry'),
      content: [{ type: 'text', text: 'BE 7654321' }],
    })
    expect(output.port.value).toBeNull()
    expect(output.exchangeRate).toEqual({ value: 83.25, confidence: 0.95 })
    expect(output.lines).toHaveLength(2)
  })

  it('rejects an answer that misses a field', async () => {
    await expect(
      generateStructured({
        runtime,
        model: textModel(JSON.stringify({ payee: { value: 'x', confidence: 1 } })),
        schema: DOCUMENT_SCHEMAS.service_bill,
        instructions: documentReaderInstructions('service_bill'),
        content: [{ type: 'text', text: 'bill' }],
      }),
    ).rejects.toThrow()
  })
})

describe('the mock model reads documents', () => {
  it.each(DOCUMENT_SHAPES)('answers the %s fixture', async (shape) => {
    const model = aiModel('documentReader', { AI_PROVIDER: 'mock' })
    expect(model).not.toBeNull()
    const { output } = await generateStructured({
      runtime,
      model: model ?? mockModel('documentReader'),
      schema: DOCUMENT_SCHEMAS[shape] as z.ZodType<unknown>,
      instructions: documentReaderInstructions(shape),
      content: [{ type: 'text', text: 'anything' }],
    })
    expect(output).toEqual(MOCK_DOCUMENTS[shape])
  })
})

describe('document content', () => {
  it('reads the text layer of a PDF', async () => {
    const text = await pdfText(
      textPdf(['COMMERCIAL INVOICE EX-2026-0042', 'M1-BLK 98 12.40', 'Total (USD) 2660.20']),
    )
    expect(text).toContain('EX-2026-0042')
    expect(text).toContain('M1-BLK 98 12.40')
    expect(text).toContain('Total (USD) 2660.20')
  })

  it('throws on a file that is not a PDF', async () => {
    await expect(pdfText(new TextEncoder().encode('not a pdf'))).rejects.toThrow()
  })

  it('sends the text when there is enough, else the file itself', () => {
    const bytes = new Uint8Array([1, 2, 3])
    const base = { fileName: 'inv.pdf', mimeType: 'application/pdf', bytes }
    const withText = documentReaderContent({ ...base, text: 'x'.repeat(200) })
    expect(withText).toHaveLength(1)
    expect(withText[0]?.type).toBe('text')
    const scan = documentReaderContent({ ...base, text: '' })
    expect(scan.at(-1)).toEqual({ type: 'file', data: bytes, mediaType: 'application/pdf' })
  })
})
