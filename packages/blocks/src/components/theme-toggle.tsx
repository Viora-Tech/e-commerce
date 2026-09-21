'use client'

import { useState } from 'react'
import type { ThemeMode } from '../types'

const next: Record<ThemeMode, ThemeMode> = { light: 'dark', dark: 'system', system: 'light' }
const label: Record<ThemeMode, string> = { light: 'Light', dark: 'Dark', system: 'Auto' }

export function ThemeToggle({ initial }: { initial: ThemeMode }) {
  const [mode, setMode] = useState<ThemeMode>(initial)

  const handleCycle = () => {
    const m = next[mode]
    setMode(m)
    const root = document.documentElement
    if (m === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', m)
    // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is not in Safari; this is a single first-party preference cookie.
    document.cookie = `theme=${m}; path=/; max-age=31536000; samesite=lax`
  }

  return (
    <button
      type="button"
      onClick={handleCycle}
      aria-label={`Theme: ${label[mode]}. Click to change.`}
      className="rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink hover:border-ink focus-visible:outline-2 focus-visible:outline-accent"
    >
      {label[mode]}
    </button>
  )
}
