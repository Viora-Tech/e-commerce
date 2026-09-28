import type { CustomSection } from '@commerce/core/theme'
import { useEffect, useSyncExternalStore } from 'react'
import { api } from './api-client'

/**
 * "My sections" in the editor: one list per session shared by the Add panel's
 * tab and the tree's "Save as my section", so a save shows in the tab at once.
 * Loaded on first use; `refresh` after any change.
 */

type State = { status: 'idle' | 'loading' | 'ready' | 'error'; items: CustomSection[] }

let state: State = { status: 'idle', items: [] }
const listeners = new Set<() => void>()

const set = (next: State) => {
  state = next
  for (const l of listeners) l()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Loads (or reloads) the store's saved sections. */
export async function refreshMySections(): Promise<void> {
  set({ ...state, status: state.items.length ? state.status : 'loading' })
  try {
    set({ status: 'ready', items: await api.themes.customSections.list() })
  } catch {
    set({ ...state, status: 'error' })
  }
}

/** Saves the given block (a section or a nested block) under `name`, then refreshes the list. */
export async function saveMySection(name: string, block: unknown): Promise<CustomSection> {
  const saved = await api.themes.customSections.save({
    name,
    block: block as { type: string; props: { id: string } },
  })
  set({ status: 'ready', items: [saved, ...state.items.filter((s) => s.id !== saved.id)] })
  return saved
}

/** Deletes a saved section. Pages already using a copy keep it. */
export async function deleteMySection(id: string): Promise<void> {
  await api.themes.customSections.delete({ id })
  set({ ...state, items: state.items.filter((s) => s.id !== id) })
}

/** The saved sections, loading them the first time a component asks. */
export function useMySections(): State {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  )
  useEffect(() => {
    if (state.status === 'idle') void refreshMySections()
  }, [])
  return snapshot
}
