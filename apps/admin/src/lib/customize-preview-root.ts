/**
 * WHAT: The Customize preview's <html>: the theme's light/dark mode on it, and none of the admin's.
 * WHY: Puck's AutoFrame copies the admin's <html> attributes into the canvas iframe when it
 *      mounts (after our effects run), so a dark admin left its next-themes `dark` class and
 *      inline `color-scheme: dark` on the storefront preview. A theme with `.dark` rules or
 *      native form controls then painted half dark over a light page. An imported theme's own
 *      boot script (theme-toggle.js, which stamps `data-theme`) never runs in the canvas, so the
 *      toolbar's Light/Dark switch has to stamp it here, for every kind of theme.
 * WHERE: `preview-frame.tsx` (install), `customize-editor.tsx` (default mode).
 */

import { useSyncExternalStore } from 'react'

/** next-themes' values with `attribute="class"` (components/layout/theme-provider.tsx). */
const ADMIN_MODE_CLASSES = ['light', 'dark'] as const

export type PreviewMode = 'light' | 'dark'

export type PreviewRootSpec = {
  mode: PreviewMode
  /**
   * Also set the inline `color-scheme` to the mode, as an imported theme's toggle script does.
   * Off for our own themes, whose CSS sets `color-scheme` per `data-theme` (core `themeToCss`).
   */
  inlineScheme: boolean
  /** The classes the theme's own <html> carries (an imported theme's layout), kept on the root. */
  classes: readonly string[]
}

function sync(root: HTMLElement, spec: PreviewRootSpec): void {
  // Only writes what differs, so the observer's own mutations settle in one pass.
  for (const name of ADMIN_MODE_CLASSES)
    if (!spec.classes.includes(name) && root.classList.contains(name)) root.classList.remove(name)
  for (const name of spec.classes) if (!root.classList.contains(name)) root.classList.add(name)
  if (root.getAttribute('data-theme') !== spec.mode) root.setAttribute('data-theme', spec.mode)
  if (spec.inlineScheme) {
    if (root.style.colorScheme !== spec.mode) root.style.colorScheme = spec.mode
  } else if (root.style.colorScheme) root.style.removeProperty('color-scheme')
}

/**
 * Holds the preview root to `spec` now and whenever its class, style or `data-theme` changes
 * (Puck's copy, a theme's attributes coming and going). Returns the uninstall.
 */
export function installPreviewRoot(doc: Document, spec: PreviewRootSpec): () => void {
  const root = doc.documentElement
  const view = doc.defaultView
  sync(root, spec)
  if (!view) return () => {}
  const observer = new view.MutationObserver(() => sync(root, spec))
  observer.observe(root, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] })
  return () => observer.disconnect()
}

/** The mode the preview opens in: the theme's default, the device's when that is "system". */
export function previewDefaultMode(
  darkMode: { enabled: boolean; default: 'light' | 'dark' | 'system' },
  deviceDark: boolean,
): PreviewMode {
  if (!darkMode.enabled) return 'light'
  if (darkMode.default === 'system') return deviceDark ? 'dark' : 'light'
  return darkMode.default
}

const DEVICE_DARK = '(prefers-color-scheme: dark)'

function subscribeDeviceDark(onChange: () => void): () => void {
  const query = window.matchMedia(DEVICE_DARK)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/** Whether the device asks for dark (`prefers-color-scheme`); light on the server. */
export function useDeviceDark(): boolean {
  return useSyncExternalStore(
    subscribeDeviceDark,
    () => window.matchMedia(DEVICE_DARK).matches,
    () => false,
  )
}
