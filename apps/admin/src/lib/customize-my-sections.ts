import type { CustomSection } from '@commerce/core/theme'
import { useEffect, useSyncExternalStore } from 'react'
import { api } from './api-client'

/**
 * "My sections" in the editor: one list per theme being edited, shared by the Add panel's tab
 * and the tree's "Save as my section", so a save shows in the tab at once. Loaded on first use;
 * `refresh` after any change. The server returns only what this theme can render: a section
 * holding an imported Shopify section stays with the theme it was saved from.
 */

type State = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  items: CustomSection[]
  /** The theme the list was loaded for; another theme's editor loads its own. */
  themeId: string | null
}

let state: State = { status: 'idle', items: [], themeId: null }
const listeners = new Set<() => void>()

const set = (next: State) => {
  state = next
  for (const l of listeners) l()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Loads (or reloads) the saved sections the theme being edited can use. */
export async function refreshMySections(themeId: string): Promise<void> {
  const same = state.themeId === themeId
  set({
    status: same && state.items.length ? state.status : 'loading',
    items: same ? state.items : [],
    themeId,
  })
  try {
    const items = await api.themes.customSections.list({ themeId })
    if (state.themeId === themeId) set({ status: 'ready', items, themeId })
  } catch {
    if (state.themeId === themeId) set({ ...state, status: 'error' })
  }
}

/**
 * Saves the given block (a section or a nested block) under `name` from the theme being edited,
 * then shows it in the list.
 */
export async function saveMySection(
  themeId: string,
  name: string,
  block: unknown,
): Promise<CustomSection> {
  const saved = await api.themes.customSections.save({
    name,
    themeId,
    block: block as { type: string; props: { id: string } },
  })
  if (state.themeId === themeId) {
    set({
      ...state,
      status: 'ready',
      items: [saved, ...state.items.filter((s) => s.id !== saved.id)],
    })
  }
  return saved
}

/** Deletes a saved section. Pages already using a copy keep it. */
export async function deleteMySection(id: string): Promise<void> {
  await api.themes.customSections.delete({ id })
  set({ ...state, items: state.items.filter((s) => s.id !== id) })
}

/** The saved sections this theme can use, loading them the first time a component asks. */
export function useMySections(themeId: string): State {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  )
  useEffect(() => {
    if (state.status === 'idle' || state.themeId !== themeId) void refreshMySections(themeId)
  }, [themeId])
  return snapshot.themeId === themeId ? snapshot : { status: 'loading', items: [], themeId }
}
