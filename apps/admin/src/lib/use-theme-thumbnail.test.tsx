// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const thumbnail = vi.fn()
const capture = vi.fn<() => Promise<string | null>>()
const isBlank = vi.fn<(url: string) => Promise<boolean | null>>()

vi.mock('./api-client', () => ({ api: { themes: { thumbnail: (i: unknown) => thumbnail(i) } } }))
vi.mock('./capture-theme-thumbnail', () => ({ captureThemeThumbnail: () => capture() }))
vi.mock('./blank-image', () => ({ isBlankImage: (url: string) => isBlank(url) }))

const { useThemeThumbnail } = await import('./use-theme-thumbnail')
const { useShownPicture } = await import('./use-shown-picture')

const STORED = 'https://cdn.test/stores/s/themes/t/thumbnail.webp?v=1'
const SHOT = 'data:image/webp;base64,UklGRg=='

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  thumbnail.mockResolvedValue({ url: 'x' })
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})
afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

function open(picture: string | null, onSavedHome = true) {
  return renderHook(() => useThemeThumbnail({ themeId: 't', picture, onSavedHome }))
}

describe('useThemeThumbnail on open', () => {
  it('retakes a blank stored picture and sends the new one', async () => {
    isBlank.mockResolvedValue(true)
    capture.mockResolvedValue(SHOT)
    open(STORED)
    await vi.advanceTimersByTimeAsync(2600)
    await waitFor(() => expect(thumbnail).toHaveBeenCalledWith({ id: 't', image: SHOT }))
  })

  it('forgets a blank stored picture it cannot retake (the card shows its placeholder)', async () => {
    isBlank.mockResolvedValue(true)
    capture.mockResolvedValue(null)
    open(STORED)
    await vi.advanceTimersByTimeAsync(2600)
    await waitFor(() => expect(thumbnail).toHaveBeenCalledWith({ id: 't', image: null }))
    expect(console.warn).toHaveBeenCalled()
  })

  it('sends nothing when a theme with no picture cannot be photographed', async () => {
    capture.mockResolvedValue(null)
    open(null)
    await vi.advanceTimersByTimeAsync(2600)
    await waitFor(() => expect(capture).toHaveBeenCalled())
    expect(thumbnail).not.toHaveBeenCalled()
  })

  it('leaves a good picture alone, and does nothing away from the saved home page', async () => {
    isBlank.mockResolvedValue(false)
    open(STORED)
    open(null, false)
    await vi.advanceTimersByTimeAsync(3000)
    expect(capture).not.toHaveBeenCalled()
    expect(thumbnail).not.toHaveBeenCalled()
  })

  it('keeps a failed save quiet (logged)', async () => {
    capture.mockResolvedValue(SHOT)
    thumbnail.mockRejectedValue(new Error('down'))
    const { result } = open(STORED, false)
    result.current.refresh()
    await waitFor(() =>
      expect(console.warn).toHaveBeenCalledWith(expect.any(String), expect.any(Error)),
    )
  })
})

describe('useShownPicture', () => {
  it('shows a picture until it is known to be blank', async () => {
    isBlank.mockResolvedValue(true)
    const { result } = renderHook(() => useShownPicture(STORED))
    expect(result.current).toBe(STORED)
    await waitFor(() => expect(result.current).toBeNull())
  })

  it('shows a good or unreadable picture, and nothing for none', async () => {
    isBlank.mockResolvedValue(null)
    const { result } = renderHook(() => useShownPicture(STORED))
    await waitFor(() => expect(isBlank).toHaveBeenCalled())
    expect(result.current).toBe(STORED)
    expect(renderHook(() => useShownPicture(null)).result.current).toBeNull()
  })
})
