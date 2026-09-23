'use client'

import { useState } from 'react'
import {
  themeToggleContent as copy,
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE_S,
  THEME_MODE_NEXT,
} from '../data/theme-toggle'
import type { ThemeMode } from '../types'
import Icon from './icon'

type ThemeToggleProps = {
  /** The mode the server rendered, from the visitor's cookie or the store default. */
  initial: ThemeMode
  /** Show the mode's name beside the icon (the footer instance). */
  withLabel?: boolean
  className?: string
}

const ICON: Record<ThemeMode, 'sun' | 'moon' | 'contrast'> = {
  light: 'sun',
  dark: 'moon',
  system: 'contrast',
}

/** Stamp the mode on <html> and remember it, so the next server render matches with no flash. */
function applyMode(mode: ThemeMode): void {
  const root = document.documentElement
  if (mode === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', mode)
  // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is not in Safari; this is a single first-party preference cookie.
  document.cookie = `${THEME_COOKIE}=${mode}; path=/; max-age=${THEME_COOKIE_MAX_AGE_S}; samesite=lax`
}

export default function ThemeToggle({ initial, withLabel = false, className }: ThemeToggleProps) {
  // Hooks
  const [mode, setMode] = useState<ThemeMode>(initial)

  // Event handlers
  const handleCycle = () => {
    const next = THEME_MODE_NEXT[mode]
    setMode(next)
    applyMode(next)
  }

  // Render logic
  const action = copy.action(copy.label[mode], copy.label[THEME_MODE_NEXT[mode]])

  return (
    <button
      type="button"
      onClick={handleCycle}
      aria-label={action}
      title={action}
      data-mode={mode}
      className={['theme-toggle', className].filter(Boolean).join(' ')}
    >
      {(Object.keys(ICON) as ThemeMode[]).map((m) => (
        <span
          key={m}
          className={`theme-toggle__icon theme-toggle__icon--${m}`}
          data-active={m === mode ? '' : undefined}
        >
          <Icon name={ICON[m]} size={22} />
        </span>
      ))}
      {withLabel ? <span className="theme-toggle__label">{copy.label[mode]}</span> : null}
    </button>
  )
}
