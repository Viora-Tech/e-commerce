'use client'

import type { Theme } from '@commerce/core/theme'
import { isThemePreviewMessage, THEME_PREVIEW_PARAM } from '@commerce/core/theme-preview'
import { useEffect } from 'react'
import { verifyThemePreview } from '@/lib/theme-preview-actions'

type ThemePreviewBridgeProps = {
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

/**
 * The theme schema and CSS builder, fetched only once a verified preview is running in
 * the admin's frame: they carry zod, which no shopper's page should download.
 */
const loadTheme = () => import('@commerce/core/theme')

/** Paints a draft exactly as the server would: the same CSS, attributes and mode. */
function paint(
  { themeToCss, themeRootAttrs }: Awaited<ReturnType<typeof loadTheme>>,
  theme: Theme,
  mode: 'light' | 'dark',
): void {
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
export default function ThemePreviewBridge({ adminOrigin }: ThemePreviewBridgeProps) {
  // Hooks
  useEffect(() => {
    const token = readToken()
    if (!token || window.parent === window) return
    let active = true
    let theme: Awaited<ReturnType<typeof loadTheme>> | null = null

    const handleMessage = (event: MessageEvent) => {
      if (!theme || event.origin !== adminOrigin || !isThemePreviewMessage(event.data)) return
      if (event.data.type !== 'theme-preview:apply') return
      const parsed = theme.ThemeSchema.safeParse(event.data.theme)
      if (!parsed.success) return
      paint(theme, parsed.data, event.data.mode === 'dark' ? 'dark' : 'light')
    }

    verifyThemePreview(token).then(async (ok) => {
      if (!ok || !active) return
      theme = await loadTheme()
      if (!active) return
      rememberToken(token)
      window.addEventListener('message', handleMessage)
      window.parent.postMessage({ type: 'theme-preview:ready' }, adminOrigin)
    })

    return () => {
      active = false
      window.removeEventListener('message', handleMessage)
    }
  }, [adminOrigin])

  // Render logic
  return null
}
