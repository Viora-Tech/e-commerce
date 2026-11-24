import { beforeEach, describe, expect, it, vi } from 'vitest'
import { leftoverDrafts } from './customize-editor'

const toast = vi.hoisted(() => ({ message: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('@/lib/customize-canvas-motion', () => ({
  prefersReducedMotion: () => true,
  scrollToSection: () => undefined,
}))

beforeEach(() => toast.message.mockReset())

describe('leftoverDrafts', () => {
  const hindi = { leftoverTitle: 'पिछली बार के बदलाव', leftoverBody: 'सेव करें', discard: 'हटाएं' }

  it('names kept drafts in the admin language on the first load', () => {
    expect(leftoverDrafts([{ draft: false }, { draft: true }], true, () => undefined, hindi)).toBe(
      true,
    )
    expect(toast.message).toHaveBeenCalledWith(
      hindi.leftoverTitle,
      expect.objectContaining({ description: hindi.leftoverBody }),
    )
  })

  it('stays quiet on a later template switch', () => {
    expect(leftoverDrafts([{ draft: true }], false, () => undefined, hindi)).toBe(true)
    expect(toast.message).not.toHaveBeenCalled()
  })
})
