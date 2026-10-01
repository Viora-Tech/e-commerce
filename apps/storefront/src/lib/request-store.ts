import 'server-only'

import { headers } from 'next/headers'

/**
 * The store a server action acts on: the one the proxy resolved from the request's hostname
 * (`x-store-id`, which the proxy always overwrites). Never a store id the browser sends or
 * that was bound into a form, since a bound argument round-trips through the browser
 * (security audit D-13). Throws when the request is not for a store (the platform login
 * domain), which a storefront action never serves.
 */
export async function requestStoreId(): Promise<string> {
  const id = (await headers()).get('x-store-id')
  if (!id) throw new Error('store not resolved')
  return id
}
