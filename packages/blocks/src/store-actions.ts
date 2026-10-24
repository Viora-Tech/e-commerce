'use client'

import { createContext, use } from 'react'

/**
 * What the storefront lets a card do for the shopper (a server action under the hood). The
 * admin canvas provides nothing, so a card's buttons there are a picture and never write.
 */
export type StoreActions = {
  /** Adds one line to the shopper's cart; the header's count refreshes with the layout. */
  addToCart?: ((variantId: string, quantity: number) => Promise<void>) | undefined
}

export const StoreActionsContext = createContext<StoreActions>({})

/**
 * Fired on `window` after anything adds to the cart (a card's Quick add, the product page), so
 * the storefront's cart drawer can open with the new line (Theme settings → Cart → Drawer).
 */
export const CART_ADDED_EVENT = 'commerce:cart-added'

export function announceCartAdded(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CART_ADDED_EVENT))
}

/** The storefront's actions, or none in the editor. */
export function useStoreActions(): StoreActions {
  return use(StoreActionsContext)
}

/**
 * Pixels app: a storefront event a block or page reports (PageView, ViewContent, AddToCart,
 * InitiateCheckout, Purchase). The storefront's listener sends it to the store's pixels only
 * after a yes to marketing; with no listener (the editor, no consent) nothing happens.
 */
export const COMMERCE_TRACK_EVENT = 'commerce:track'

export type CommerceTrackDetail = {
  name: 'PageView' | 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase'
  /** Set for events tied to a record (`ord_<orderId>`, `ic_<cartId>`); else the listener mints one. */
  eventId?: string | undefined
  productId?: string | undefined
  variantId?: string | undefined
  valuePaise?: number | undefined
  contentIds?: string[] | undefined
  numItems?: number | undefined
  /** Set by the listener once sent, so a late listener does not send it twice. */
  handled?: boolean | undefined
}

const TRACK_QUEUE = '__commerceTrack'
const TRACK_QUEUE_MAX = 20

type TrackWindow = { [TRACK_QUEUE]?: CommerceTrackDetail[] }

/**
 * Report an event. It is also kept on `window` (the last 20), because a page's event can fire
 * before the listener mounts (child effects run before the layout's).
 */
export function trackCommerce(detail: CommerceTrackDetail): void {
  if (typeof window === 'undefined') return
  const w = window as unknown as TrackWindow
  w[TRACK_QUEUE] ??= []
  const queue = w[TRACK_QUEUE]
  queue.push(detail)
  if (queue.length > TRACK_QUEUE_MAX) queue.shift()
  window.dispatchEvent(new CustomEvent(COMMERCE_TRACK_EVENT, { detail }))
}

/** Events reported before the listener mounted and not yet sent. */
export function pendingCommerceTracks(): CommerceTrackDetail[] {
  if (typeof window === 'undefined') return []
  return ((window as unknown as TrackWindow)[TRACK_QUEUE] ?? []).filter((d) => !d.handled)
}
