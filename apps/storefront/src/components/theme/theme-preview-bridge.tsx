'use client'

import {
  isThemePreviewMessage,
  THEME_PREVIEW_PARAM,
  type Theme,
  ThemeSchema,
  themeRootAttrs,
  themeToCss,
} from '@commerce/core/theme'
import { useEffect } from 'react'
import { verifyThemePreview } from '@/lib/theme-preview-actions'

type ThemePreviewBridgeProps = {
  storeId: string
  /** The admin's origin; the only sender whose messages are applied. */
  adminOrigin: string
}

const TOKEN_KEY = 'theme-preview-token'
const STYLE_ID = 'theme-preview-style'

/** The token from the URL, or from this frame's session once a link inside it was followed. */
function readToken(): string | null {
  const fromUrl = new URLSearchParams(window.location.search).get(THEME_PREVIEW_PARAM)
  if (fromUrl) return fromUrl
  try {
    return window.sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function rememberToken(token: string): void {
  try {
    window.sessionStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Storage blocked: navigating inside the preview just shows the saved theme.
  }
}

/** Paints a draft exactly as the server would: the same CSS, attributes and mode. */
function paint(theme: Theme, mode: 'light' | 'dark'): void {
  let style = document.getElementById(STYLE_ID)
  if (!style) {
    style = document.createElement('style')
    style.id = STYLE_ID
    document.head.appendChild(style)
  }
  style.textContent = themeToCss(theme)
  const root = document.documentElement
  for (const [name, value] of Object.entries(themeRootAttrs(theme))) {
    root.setAttribute(name, value)
  }
  root.setAttribute('data-theme', mode)
}

/**
 * Lets the admin theme editor restyle this page live without saving. Inert unless
 * the page was opened with a preview token the server verifies for this store, and
 * even then it only applies messages from the admin origin that parse as a theme.
 */
export default function ThemePreviewBridge({ storeId, adminOrigin }: ThemePreviewBridgeProps) {
  // Hooks
  useEffect(() => {
    const token = readToken()
    if (!token || window.parent === window) return
    let active = true

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== adminOrigin || !isThemePreviewMessage(event.data)) return
      if (event.data.type !== 'theme-preview:apply') return
      const parsed = ThemeSchema.safeParse(event.data.theme)
      if (!parsed.success) return
      paint(parsed.data, event.data.mode === 'dark' ? 'dark' : 'light')
    }

    verifyThemePreview(storeId, token).then((ok) => {
      if (!ok || !active) return
      rememberToken(token)
      window.addEventListener('message', handleMessage)
      window.parent.postMessage({ type: 'theme-preview:ready' }, adminOrigin)
    })

    return () => {
      active = false
      window.removeEventListener('message', handleMessage)
    }
  }, [storeId, adminOrigin])

  // Render logic
  return null
}
