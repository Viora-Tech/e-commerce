'use client'

import { INBOX_APP_ID, type InboxSettings } from '@commerce/core/inbox'
import { useEffect, useSyncExternalStore } from 'react'
import { api } from './api-client'

/**
 * The Inbox app's chat settings while the theme editor is open, shared by the App embeds panel
 * (`InboxEmbedCard`, which edits them) and the canvas (`CanvasInboxLauncher`, which draws the
 * chat button where the store will show it). One copy, so a change in the panel moves the
 * button on the canvas at once.
 */
export type InboxEmbedState = {
  settings: InboxSettings | null
  loadFailed: boolean
}

let state: InboxEmbedState = { settings: null, loadFailed: false }
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()

function emit(next: InboxEmbedState) {
  state = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getState = () => state

/** Loads the chat settings once per editor visit; later calls reuse the first. */
export function loadInboxEmbed(): Promise<void> {
  if (state.settings) return Promise.resolve()
  loading ??= api.inbox.settings.get().then(
    (r) => emit({ settings: r.settings, loadFailed: false }),
    () => {
      loading = null
      emit({ ...state, loadFailed: true })
    },
  )
  return loading
}

/** Applies an edit locally (the panel saves it to the app separately). */
export function patchInboxEmbed(patch: Partial<InboxSettings>) {
  if (!state.settings) return
  emit({ ...state, settings: { ...state.settings, ...patch } })
}

export function useInboxEmbed(): InboxEmbedState {
  return useSyncExternalStore(subscribe, getState, getState)
}

/** For tests: back to nothing loaded. */
export function resetInboxEmbed() {
  loading = null
  emit({ settings: null, loadFailed: false })
}

/** Loads the chat settings when the Inbox app is installed, so the canvas can draw the button. */
export function useInboxEmbedFor(installedApps: readonly string[]) {
  const hasInbox = installedApps.includes(INBOX_APP_ID)
  useEffect(() => {
    if (hasInbox) void loadInboxEmbed()
  }, [hasInbox])
}
