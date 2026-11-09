// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { installPreviewRoot, previewDefaultMode } from './customize-preview-root'

/** What Puck's AutoFrame does when the canvas mounts: copies the admin <html> attributes over. */
function puckSync(root: HTMLElement): void {
  root.setAttribute('class', '_font_variable _mono_variable dark')
  root.setAttribute('style', 'color-scheme: dark;')
}

/** A tick, for MutationObserver callbacks. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

let uninstall: () => void = () => {}
afterEach(() => {
  uninstall()
  const root = document.documentElement
  for (const name of Array.from(root.attributes, (a) => a.name)) root.removeAttribute(name)
})

describe('installPreviewRoot', () => {
  it("drops the admin's colour-mode class and keeps its font classes", async () => {
    const root = document.documentElement
    uninstall = installPreviewRoot(document, { mode: 'light', inlineScheme: false, classes: [] })
    puckSync(root)
    await flush()
    expect(root.classList.contains('dark')).toBe(false)
    expect(root.classList.contains('_font_variable')).toBe(true)
    expect(root.getAttribute('data-theme')).toBe('light')
    expect(root.style.colorScheme).toBe('')
  })

  it("stamps the toolbar's mode on an imported theme, with its color-scheme, after Puck's copy", async () => {
    const root = document.documentElement
    root.setAttribute('data-theme', 'light') // the theme's <html data-theme="light">
    uninstall = installPreviewRoot(document, {
      mode: 'dark',
      inlineScheme: true,
      classes: ['js', 'media-parallax'],
    })
    puckSync(root)
    await flush()
    expect(root.getAttribute('data-theme')).toBe('dark')
    expect(root.style.colorScheme).toBe('dark')
    // The theme's own <html> classes come back after Puck replaced the attribute.
    expect(root.classList.contains('js')).toBe(true)
    expect(root.classList.contains('media-parallax')).toBe(true)
    // A dark preview still never carries the admin's `dark` class.
    expect(root.classList.contains('dark')).toBe(false)
  })

  it("keeps a `dark` class the theme's own <html> carries", async () => {
    const root = document.documentElement
    uninstall = installPreviewRoot(document, {
      mode: 'light',
      inlineScheme: true,
      classes: ['dark'],
    })
    puckSync(root)
    await flush()
    expect(root.classList.contains('dark')).toBe(true)
  })

  it('puts the mode back when something else changes it, and stops once uninstalled', async () => {
    const root = document.documentElement
    uninstall = installPreviewRoot(document, { mode: 'dark', inlineScheme: false, classes: [] })
    root.removeAttribute('data-theme')
    await flush()
    expect(root.getAttribute('data-theme')).toBe('dark')
    uninstall()
    uninstall = () => {}
    root.setAttribute('data-theme', 'light')
    await flush()
    expect(root.getAttribute('data-theme')).toBe('light')
  })
})

describe('previewDefaultMode', () => {
  it("opens on the theme's default mode, the device's for system", () => {
    expect(previewDefaultMode({ enabled: true, default: 'dark' }, false)).toBe('dark')
    expect(previewDefaultMode({ enabled: true, default: 'light' }, true)).toBe('light')
    expect(previewDefaultMode({ enabled: true, default: 'system' }, true)).toBe('dark')
    expect(previewDefaultMode({ enabled: true, default: 'system' }, false)).toBe('light')
  })

  it('is light when the theme has no dark mode', () => {
    expect(previewDefaultMode({ enabled: false, default: 'dark' }, true)).toBe('light')
  })
})
