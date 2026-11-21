// @vitest-environment jsdom
import { defaultTheme } from '@commerce/core/theme'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { themesContent } from '@/data/themes'

const isBlank = vi.fn<(url: string) => Promise<boolean | null>>()
vi.mock('@/lib/blank-image', () => ({ isBlankImage: (url: string) => isBlank(url) }))

const { default: ThemePreviewStage } = await import('./theme-preview-stage')

const copy = themesContent.library
const SHOT = 'https://cdn.test/stores/s/themes/t/thumbnail.webp?v=1'
const COVER = 'http://localhost:3200/uploads/stores/s/media/hero-poster.jpg'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function stage(picture: string | null, cover: string | null) {
  render(
    <ThemePreviewStage
      name="Glide"
      origin="https://shop.test"
      settings={defaultTheme}
      picture={picture}
      cover={cover}
    />,
  )
}

const shown = () => screen.queryByRole('img', { name: copy.thumbnail('Glide') })

describe('ThemePreviewStage', () => {
  it('shows the screenshot when there is one', () => {
    isBlank.mockResolvedValue(false)
    stage(SHOT, COVER)
    expect(shown()?.getAttribute('src')).toBe(SHOT)
  })

  it('shows the saved home page cover when there is no screenshot', () => {
    stage(null, COVER)
    const img = shown()
    expect(img?.getAttribute('src')).toBe(COVER)
    expect(img?.getAttribute('title')).toBe(copy.coverHint)
  })

  it('falls back to the cover when the stored screenshot is blank', async () => {
    isBlank.mockResolvedValue(true)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    stage(SHOT, COVER)
    await waitFor(() => expect(shown()?.getAttribute('src')).toBe(COVER))
  })

  it('falls back to the cover when the screenshot does not load', async () => {
    isBlank.mockResolvedValue(null)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    stage(SHOT, COVER)
    fireEvent.error(shown() as HTMLElement)
    await waitFor(() => expect(shown()?.getAttribute('src')).toBe(COVER))
    expect(shown()?.getAttribute('title')).toBe(copy.coverHint)
  })

  it('falls back to the swatch when the cover does not load (a file missing from storage)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    stage(null, COVER)
    fireEvent.error(shown() as HTMLElement)
    await waitFor(() => expect(shown()?.tagName).toBe('SPAN'))
    expect(shown()?.getAttribute('title')).toBe(copy.pictureHint)
  })

  it('falls back to the swatch when the phone frame picture fails too', async () => {
    isBlank.mockResolvedValue(null)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { container } = render(
      <ThemePreviewStage
        name="Glide"
        origin="https://shop.test"
        settings={defaultTheme}
        picture={SHOT}
        cover={COVER}
      />,
    )
    const phone = () => container.querySelector('img[alt=""]') as HTMLElement
    fireEvent.error(phone())
    await waitFor(() => expect(phone()?.getAttribute('src')).toBe(COVER))
    fireEvent.error(phone())
    await waitFor(() => expect(container.querySelector('img')).toBeNull())
  })

  it('keeps the swatch only when there is neither', () => {
    stage(null, null)
    const swatch = shown()
    expect(swatch?.tagName).toBe('SPAN')
    expect(swatch?.getAttribute('title')).toBe(copy.pictureHint)
  })
  it('falls back when the cover had already failed before the page started (no error event)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const complete = vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true)
    const width = vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(0)
    stage(null, COVER)
    await waitFor(() => expect(shown()?.tagName).toBe('SPAN'))
    complete.mockRestore()
    width.mockRestore()
  })
})
