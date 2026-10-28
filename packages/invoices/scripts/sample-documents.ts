/**
 * Renders the sample GST documents the marketing site offers for download
 * (apps/www/public/samples/): a B2B inter-state tax invoice and the credit
 * note a refund on it produces. Same templates and builder as the admin's
 * settings preview (`sampleDocument`), so accountants see real output, with a
 * seller and buyer that are plainly samples.
 *
 *   bun packages/invoices/scripts/sample-documents.ts
 *
 * Run it again after a template change and commit the PDFs.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gstinCheckChar } from '@commerce/core/gstin'
import { InvoiceSettingsSchema } from '../src/settings'
import { sampleDocument } from '../src/sample'
import type { DocumentKind } from '../src/snapshot'
import { renderDocumentToBuffer } from '../src/pdf/render'

const OUT_DIR = join(import.meta.dir, '..', '..', '..', 'apps', 'www', 'public', 'samples')
const STORE = 'Sample Store (not a real business)'
// Haryana (06), a placeholder PAN; the check digit makes it pass the validator.
const SELLER_GSTIN_14 = '06AAAAA0000A1Z'

const settings = InvoiceSettingsSchema.parse({
  seller: {
    legalName: STORE,
    gstin: SELLER_GSTIN_14 + gstinCheckChar(SELLER_GSTIN_14),
    line1: '14 Sector 29',
    city: 'Gurugram',
    stateCode: 'HR',
    pincode: '122001',
  },
})

const FILES: readonly { kind: DocumentKind; name: string }[] = [
  { kind: 'tax_invoice', name: 'sample-gst-tax-invoice.pdf' },
  { kind: 'credit_note', name: 'sample-gst-credit-note.pdf' },
]

mkdirSync(OUT_DIR, { recursive: true })
for (const { kind, name } of FILES) {
  const doc = sampleDocument(settings, kind, STORE)
  const bytes = await renderDocumentToBuffer({ doc, settings, assets: { logo: null, signature: null } })
  writeFileSync(join(OUT_DIR, name), bytes)
  console.log(`wrote ${name} (${Math.round(bytes.length / 1024)} KB)`)
}
