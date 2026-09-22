'use client'

import {
  stripResolved as clean,
  stableTemplateJson as stableJson,
  type TemplateData,
  type TemplateKey,
} from '@commerce/core/theme'
import { useRef } from 'react'
import { api } from '@/lib/api-client'
import { type CustomizeDoc, splitDoc } from './customize-doc'

type Ref = { key: TemplateKey; suffix: string }
type Part = { template: TemplateKey; suffix: string; data: TemplateData }

const DEBOUNCE_MS = 600

/** The three rows a Customize document saves to. */
export function partsOf(ref: Ref, doc: CustomizeDoc): Part[] {
  const { header, main, footer } = splitDoc(doc)
  return [
    { template: 'header', suffix: '', data: clean(header) },
    { template: ref.key, suffix: ref.suffix, data: clean(main) },
    { template: 'footer', suffix: '', data: clean(footer) },
  ]
}

const keyOf = (p: Part) => `${p.template}.${p.suffix}`

/**
 * Keeps Customize edits as theme drafts: each change is written (debounced) to
 * the rows whose content changed, so a reload keeps unsaved work. Save commits.
 */
export function useTemplateDrafts(themeId: string, onError: () => void) {
  // Hooks
  const sent = useRef(new Map<string, string>())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef<Part[] | null>(null)
  const inflight = useRef<Promise<void>>(Promise.resolve())

  // Helpers
  const write = async (parts: Part[]) => {
    for (const part of parts) {
      const json = stableJson(part.data)
      if (sent.current.get(keyOf(part)) === json) continue
      sent.current.set(keyOf(part), json)
      await api.themes.templates.saveDraft({ themeId, ...part })
    }
  }

  const flush = async () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const parts = latest.current
    latest.current = null
    inflight.current = inflight.current
      .then(() => (parts ? write(parts) : undefined))
      .catch(onError)
    await inflight.current
  }

  /** Remembers what is stored, so only real edits are written. */
  const prime = (parts: Part[]) => {
    if (timer.current) clearTimeout(timer.current)
    latest.current = null
    for (const part of parts) sent.current.set(keyOf(part), stableJson(part.data))
  }

  /** Whether `parts` differ from what is stored. */
  const differs = (parts: Part[]) =>
    parts.some((p) => sent.current.get(keyOf(p)) !== stableJson(p.data))

  const schedule = (parts: Part[]) => {
    latest.current = parts
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), DEBOUNCE_MS)
  }

  /** Whether an edit is still waiting to be written (leaving now would lose it). */
  const pending = () => latest.current !== null

  return { schedule, flush, prime, differs, pending }
}
