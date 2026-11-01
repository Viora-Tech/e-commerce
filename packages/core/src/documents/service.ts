/** SOURCE OF TRUTH: listDocumentTemplates, saveDocumentTemplate, resetDocumentTemplate,
 *   documentStore, gstInvoicesInstalled
 * WHAT:  The store's printed-document templates (audit #164): what each kind prints with (the
 *        merchant's HTML or the default), saving and resetting one, and the store header they
 *        print (name, address, contact, GSTIN).
 * WHY:   The templates and their merge tags are pure (`templates.ts`); this is the database side.
 *        The GST invoice belongs to the GST invoices app: when it is installed, the Invoice
 *        template here is not used for tax invoices (the admin says so and links to the app).
 */
import { documentTemplate, type StoreTx, store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { parseAppsSettings } from '../apps/settings'
import { StoreAddressSchema } from '../settings/general'
import { INDIAN_STATE_NAMES } from '../tax/states'
import {
  DEFAULT_TEMPLATES,
  DOCUMENT_KINDS,
  type DocStore,
  type DocumentKind,
  type DocumentTemplateWrite,
  DocumentTemplateWriteSchema,
} from './templates'

const GST_INVOICES_APP_ID = 'gst-invoices'

export type DocumentTemplateView = {
  kind: DocumentKind
  /** What prints: the merchant's HTML, else the default. */
  html: string
  /** True when the merchant changed it from the default. */
  custom: boolean
  updatedAt: Date | null
}

/** Every kind, the merchant's template where there is one. RLS scopes the rows. */
export async function listDocumentTemplates(tx: StoreTx): Promise<DocumentTemplateView[]> {
  const rows = await tx.select().from(documentTemplate)
  return DOCUMENT_KINDS.map((kind) => {
    const row = rows.find((r) => r.kind === kind)
    return {
      kind,
      html: row?.html ?? DEFAULT_TEMPLATES[kind],
      custom: Boolean(row),
      updatedAt: row?.updatedAt ?? null,
    }
  })
}

export async function getDocumentTemplate(
  tx: StoreTx,
  kind: DocumentKind,
): Promise<DocumentTemplateView> {
  const all = await listDocumentTemplates(tx)
  return all.find((t) => t.kind === kind) as DocumentTemplateView
}

/** Save the merchant's HTML for one kind; the default's exact text goes back to the default. */
export async function saveDocumentTemplate(
  tx: StoreTx,
  storeId: string,
  raw: DocumentTemplateWrite,
): Promise<DocumentTemplateView> {
  const { kind, html } = DocumentTemplateWriteSchema.parse(raw)
  if (html.trim() === '' || html === DEFAULT_TEMPLATES[kind]) {
    return resetDocumentTemplate(tx, kind)
  }
  await tx
    .insert(documentTemplate)
    .values({ storeId, kind, html })
    .onConflictDoUpdate({
      target: [documentTemplate.storeId, documentTemplate.kind],
      set: { html, updatedAt: new Date() },
    })
  return getDocumentTemplate(tx, kind)
}

/** Back to the built-in template. */
export async function resetDocumentTemplate(
  tx: StoreTx,
  kind: DocumentKind,
): Promise<DocumentTemplateView> {
  await tx.delete(documentTemplate).where(eq(documentTemplate.kind, kind))
  return getDocumentTemplate(tx, kind)
}

/** The store header documents print: name, one-line address, contact and GSTIN. */
export async function documentStore(tx: StoreTx, storeId: string): Promise<DocStore> {
  const [s] = await tx
    .select({
      name: store.name,
      email: store.contactEmail,
      phone: store.contactPhone,
      address: store.address,
      gstin: store.gstin,
    })
    .from(store)
    .where(eq(store.id, storeId))
  const parsed = StoreAddressSchema.safeParse(s?.address ?? {})
  const a = parsed.success ? parsed.data : null
  const state = a ? (INDIAN_STATE_NAMES[a.state.toUpperCase()] ?? a.state) : ''
  const address = a
    ? [a.line1, a.line2, a.city, [state, a.pincode].filter(Boolean).join(' ')]
        .filter((p) => p.trim())
        .join(', ')
    : ''
  return {
    name: s?.name ?? '',
    email: s?.email ?? null,
    phone: s?.phone ?? null,
    address: address || null,
    gstin: s?.gstin ?? null,
  }
}

/** The GST invoices app owns tax invoices when it is installed. */
export async function gstInvoicesInstalled(tx: StoreTx, storeId: string): Promise<boolean> {
  const [s] = await tx.select({ apps: store.apps }).from(store).where(eq(store.id, storeId))
  return parseAppsSettings(s?.apps).installed.includes(GST_INVOICES_APP_ID)
}
