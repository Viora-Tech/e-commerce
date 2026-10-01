/**
 * The store a server action may act on when its store id was bound into the form: a bound
 * argument round-trips through the browser, so it only counts when it is the store the
 * proxy resolved from the hostname (`x-store-id`).
 */
export function boundStoreId(bound: unknown, resolved: string | null): string | null {
  return resolved && typeof bound === 'string' && bound === resolved ? resolved : null
}
