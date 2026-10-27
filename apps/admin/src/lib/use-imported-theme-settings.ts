'use client'

import { useEffect, useState } from 'react'
import { api } from './api-client'
import type { LiquidHead } from './customize-theme-context'
import { changedSettings } from './imported-theme-settings'
import type { LiquidEditorInfo } from './use-liquid-theme'

/** How long edits must stay still before the canvas head is rendered again with them. */
const HEAD_SETTLE_MS = 300

export type ImportedThemeSettings = {
  /** Saved values with the unsaved edits over them, by setting id. */
  values: Record<string, unknown>
  /** What changed since the last save (a removed value is null). */
  changes: Record<string, unknown>
  dirty: boolean
  /** The theme's head for the canvas, rendered again with the edits; null for our own themes. */
  head: LiquidHead | null
  onChange: (values: Record<string, unknown>) => void
  /** Saves the changes into the theme (`themes.import.saveSettings`); throws when it fails. */
  save: () => Promise<void>
  /** Drops the unsaved edits. */
  discard: () => void
}

/**
 * An imported Shopify theme's own Theme settings in Customize (`settings_schema.json`): the
 * values as edited, what changed since the last save, and the theme's head re-rendered with
 * the edits so the canvas shows new colours and fonts before Save.
 */
export function useImportedThemeSettings(
  themeId: string,
  info: LiquidEditorInfo | null | undefined,
): ImportedThemeSettings {
  const [saved, setSaved] = useState<Record<string, unknown>>({})
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [head, setHead] = useState<LiquidHead | null>(null)
  /** Moves on every save, so the head is rendered again from the saved values. */
  const [saves, setSaves] = useState(0)

  useEffect(() => {
    const loaded = info?.settingValues ?? {}
    setSaved(loaded)
    setValues(loaded)
    setHead(null)
  }, [info])

  const changes = changedSettings(saved, values)
  const changesKey = JSON.stringify(changes)

  useEffect(() => {
    if (!info) return
    // Nothing edited or saved since the page loaded: the loaded head is the right one.
    if (changesKey === '{}' && saves === 0) {
      setHead(null)
      return
    }
    let active = true
    const timer = window.setTimeout(() => {
      api.themes.import
        .head({ themeId, themeSettings: JSON.parse(changesKey) as Record<string, unknown> })
        .then(
          (next) => active && next && setHead(next),
          () => undefined,
        )
    }, HEAD_SETTLE_MS)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [themeId, info, changesKey, saves])

  const save = async () => {
    if (changesKey === '{}') return
    const result = await api.themes.import.saveSettings({ themeId, values: changes })
    const next: Record<string, unknown> = {}
    for (const id of Object.keys(values)) if (id in result.settings) next[id] = result.settings[id]
    for (const id of Object.keys(saved)) if (id in result.settings) next[id] = result.settings[id]
    setSaved(next)
    setValues(next)
    setSaves((n) => n + 1)
  }

  const discard = () => setValues(saved)

  return {
    values,
    changes,
    dirty: changesKey !== '{}',
    head:
      head ??
      (info
        ? {
            head: info.head,
            beforeHeader: info.beforeHeader,
            fontsHref: info.fontsHref,
            htmlAttrs: info.htmlAttrs,
          }
        : null),
    onChange: setValues,
    save,
    discard,
  }
}
