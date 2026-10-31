/** SOURCE OF TRUTH: effective HSN code and GST rate of a variant (#63) — WHAT the variant's own value, else its product's / WHY HSN and GST are set once per product, so checkout, drafts, order edits, invoices and customs labels must all resolve them the same way */
import { product, variant } from '@commerce/db'
import { sql } from 'drizzle-orm'

/** Select fragments for a query that joins `variant` to its `product`. */
export const effectiveHsCode = sql<
  string | null
>`coalesce(nullif(${variant.hsCode}, ''), nullif(${product.hsCode}, ''))`

/** Null still means "the store default rate". */
export const effectiveGstRatePercent = sql<
  number | null
>`coalesce(${variant.gstRatePercent}, ${product.gstRatePercent})`
