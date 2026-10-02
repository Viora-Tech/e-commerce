/**
 * Where the merchant is, as one plain line for the assistant's prompt ("the product "Glide
 * Mouse" (handle: glide-mouse)"). The browser sends only the page kind and a record id; the
 * title, handle or number comes from the store's own row read here under RLS, so another
 * store's id finds nothing. Customer pages say only "a customer's page": no name or contact.
 */
import { type AssistantPageContext, guardData } from '@commerce/ai'
import { collection, order, product, type StoreTx } from '@commerce/db'
import { eq } from 'drizzle-orm'

const LISTS: Record<string, string> = {
  home: 'Home (the dashboard)',
  products: 'the Products list',
  collections: 'the Collections list',
  orders: 'the Orders list',
  discounts: 'the Discounts page',
  customers: 'the Customers list',
  analytics: 'Analytics',
  settings: 'Settings',
  other: 'a page of the admin',
}

const name = (text: string) => guardData(text, 120).text.replace(/"/g, "'")

export async function pageLine(tx: StoreTx, context: AssistantPageContext): Promise<string> {
  const id = context.entityId
  if (context.page === 'product' && id) {
    const [row] = await tx
      .select({ title: product.title, handle: product.handle })
      .from(product)
      .where(eq(product.id, id))
    if (row) return `the product "${name(row.title)}" (handle: ${row.handle})`
  }
  if (context.page === 'collection' && id) {
    const [row] = await tx
      .select({ title: collection.title, handle: collection.handle })
      .from(collection)
      .where(eq(collection.id, id))
    if (row) return `the collection "${name(row.title)}" (handle: ${row.handle})`
  }
  if (context.page === 'order' && id) {
    const [row] = await tx.select({ number: order.number }).from(order).where(eq(order.id, id))
    if (row) return `order #${row.number}`
  }
  if (context.page === 'customer') return "a customer's page (no customer details are shared)"
  return LISTS[context.page] ?? LISTS.other ?? 'the admin'
}
