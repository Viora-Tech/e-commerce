/** SOURCE OF TRUTH: suppliers (create, edit, delete) — WHAT: the people a store buys stock
 * from, with GSTIN, country, billing currency and payment terms. WHY: a purchase order picks
 * a supplier instead of retyping one, and starts in the supplier's currency.
 */
import { newId, type StoreTx, supplier } from '@commerce/db'
import { and, eq, ne, sql } from 'drizzle-orm'
import { InventoryError } from './levels'
import type { SupplierInput } from './schemas'

export async function saveSupplier(
  tx: StoreTx,
  storeId: string,
  input: SupplierInput,
): Promise<string> {
  const fields = {
    name: input.name,
    gstin: input.gstin || null,
    country: input.country,
    currency: input.currency,
    email: input.email || null,
    phone: input.phone || null,
    address: input.address || null,
    paymentTerms: input.paymentTerms || null,
    notes: input.notes || null,
    updatedAt: new Date(),
  }
  // One record per supplier: "Uncle Panda" had been added twice, once per country (audit #76).
  const [clash] = await tx
    .select({ id: supplier.id })
    .from(supplier)
    .where(
      and(
        sql`lower(trim(${supplier.name})) = ${input.name.trim().toLowerCase()}`,
        input.id ? ne(supplier.id, input.id) : undefined,
      ),
    )
  if (clash) {
    throw new InventoryError(
      'SUPPLIER_EXISTS',
      `A supplier named ${input.name.trim()} already exists; edit that one instead`,
      { storeId },
    )
  }
  if (!input.id) {
    const id = newId()
    await tx.insert(supplier).values({ id, storeId, ...fields })
    return id
  }
  const [row] = await tx
    .update(supplier)
    .set(fields)
    .where(eq(supplier.id, input.id))
    .returning({ id: supplier.id })
  if (!row) throw new InventoryError('SUPPLIER_NOT_FOUND', 'Supplier not found', { storeId })
  return row.id
}

/** Purchase orders keep the supplier's name; they just stop pointing at the record. */
export async function deleteSupplier(tx: StoreTx, storeId: string, id: string): Promise<void> {
  const [row] = await tx.delete(supplier).where(eq(supplier.id, id)).returning({ id: supplier.id })
  if (!row) throw new InventoryError('SUPPLIER_NOT_FOUND', 'Supplier not found', { storeId })
}

/** Throws unless the supplier belongs to this store (foreign keys skip row-level security). */
export async function assertSupplier(tx: StoreTx, storeId: string, id: string): Promise<void> {
  const [row] = await tx.select({ id: supplier.id }).from(supplier).where(eq(supplier.id, id))
  if (!row) throw new InventoryError('SUPPLIER_NOT_FOUND', 'Supplier not found', { storeId })
}
