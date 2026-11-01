/**
 * Where the merchant is, as one plain line for the assistant's prompt ("the product "Glide
 * Mouse" (handle: glide-mouse)"). The browser sends only the page kind and a record id; the
 * title, handle or number comes from the store's own row read here under RLS, so another
 * store's id finds nothing. Customer pages say only "a customer's page": no name or contact. The
 * theme editor names the theme and whether it is live from its row, not from the browser.
 */
import { type AssistantPageContext, guardData } from '@commerce/ai'
import { collection, order, product, type StoreTx, theme } from '@commerce/db'
import { eq, inArray } from 'drizzle-orm'

const LISTS: Record<string, string> = {
  home: 'Home (the dashboard)',
  products: 'the Products list',
  collections: 'the Collections list',
  orders: 'the Orders list',
  discounts: 'the Discounts page',
  customers: 'the Customers list',
  analytics: 'Analytics',
  markets: 'the Markets page (countries the store sells to)',
  rollouts: 'the Rollouts page (scheduled theme, checkout and discount changes)',
  settings: 'Settings',
  other: 'a page of the admin',
}

const name = (text: string) => guardData(text, 120).text.replace(/"/g, "'")

/** Most ticked rows named one by one; the rest are counted. */
const NAMED = 30

/**
 * The rows ticked in the list, read under RLS: products and collections by title and handle,
 * orders by number, customers only counted. "These"/"selected" in the message means exactly
 * them, never records named earlier in the conversation (#983).
 */
async function selectionLine(tx: StoreTx, context: AssistantPageContext): Promise<string> {
  const ids = context.selectedIds ?? []
  if (!ids.length) return ''
  let names: string[] = []
  let noun = 'rows'
  if (context.page === 'products') {
    noun = 'products'
    const rows = await tx
      .select({ title: product.title, handle: product.handle })
      .from(product)
      .where(inArray(product.id, ids))
    names = rows.map((r) => `"${name(r.title)}" (handle: ${r.handle})`)
  } else if (context.page === 'collections') {
    noun = 'collections'
    const rows = await tx
      .select({ title: collection.title, handle: collection.handle })
      .from(collection)
      .where(inArray(collection.id, ids))
    names = rows.map((r) => `"${name(r.title)}" (handle: ${r.handle})`)
  } else if (context.page === 'orders') {
    noun = 'orders'
    const rows = await tx.select({ number: order.number }).from(order).where(inArray(order.id, ids))
    names = rows.map((r) => `#${r.number}`)
  } else if (context.page === 'customers') {
    return ` The merchant has ticked ${ids.length} customers in the list (no customer details are shared).`
  } else {
    return ''
  }
  if (!names.length) return ''
  const shown = names.slice(0, NAMED).join(', ')
  const more = names.length > NAMED ? ` and ${names.length - NAMED} more` : ''
  return ` The merchant has ticked ${names.length} ${noun} in the list: ${shown}${more}. When the message says "these", "selected", "them" or does not name ${noun}, it means exactly these ticked ${noun}, not any named earlier in the conversation.`
}

export async function pageLine(tx: StoreTx, context: AssistantPageContext): Promise<string> {
  const base = await placeLine(tx, context)
  return `${base}${await selectionLine(tx, context)}`
}

async function placeLine(tx: StoreTx, context: AssistantPageContext): Promise<string> {
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
  if (context.page === 'theme-editor' && id) {
    const [row] = await tx
      .select({ name: theme.name, role: theme.role })
      .from(theme)
      .where(eq(theme.id, id))
    if (row) {
      const state = row.role === 'main' ? 'the live, published theme' : 'not published'
      return `the theme editor (Customize) for the theme "${name(row.name)}" (${state})`
    }
  }
  if (context.page === 'theme-editor') return 'the theme editor (Customize)'
  if (context.page === 'customer') return "a customer's page (no customer details are shared)"
  return LISTS[context.page] ?? LISTS.other ?? 'the admin'
}
