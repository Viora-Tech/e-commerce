// @vitest-environment jsdom
import { defaultTheme } from '@commerce/core/theme'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
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

  it('keeps the swatch only when there is neither', () => {
    stage(null, null)
    const swatch = shown()
    expect(swatch?.tagName).toBe('SPAN')
    expect(swatch?.getAttribute('title')).toBe(copy.pictureHint)
  })
})
