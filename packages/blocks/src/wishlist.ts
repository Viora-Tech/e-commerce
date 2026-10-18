'use client'

import { useSyncExternalStore } from 'react'
import { storageKey } from './storage-keys'

/**
 * The shopper's wishlist, kept on this device (Figma Wishlist: "Saved on this device"). Product
 * handles, newest first, in local storage; every heart and the wishlist page read the same list
 * and hear each change, including changes made in another tab.
 */
const KEY = storageKey('wishlist')
const CHANGE = 'wishlist:change'
const EMPTY: readonly string[] = []
const MAX = 100

let cached: { raw: string | null; list: readonly string[] } = { raw: null, list: EMPTY }

function read(): readonly string[] {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(KEY)
  } catch {
    return EMPTY
  }
  if (raw === cached.raw) return cached.list
  let list: readonly string[] = EMPTY
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : []
    list = Array.isArray(parsed) ? parsed.filter((h): h is string => typeof h === 'string') : EMPTY
  } catch {
    list = EMPTY
  }
  cached = { raw, list }
  return list
}

function write(list: readonly string[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
  } catch {
    // Private mode or a full store: the heart simply does not stick.
  }
  window.dispatchEvent(new Event(CHANGE))
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) onChange()
  }
  window.addEventListener(CHANGE, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CHANGE, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

/** Adds the handle when it is missing, removes it when it is there. */
export function toggleWishlist(handle: string): void {
  const list = read()
  write(list.includes(handle) ? list.filter((h) => h !== handle) : [handle, ...list])
}

/** Removes a handle (the wishlist page's "Move to cart"). */
export function removeFromWishlist(handle: string): void {
  write(read().filter((h) => h !== handle))
}

/** The saved handles; empty on the server and until the page has hydrated. */
export function useWishlist(): readonly string[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY)
}
