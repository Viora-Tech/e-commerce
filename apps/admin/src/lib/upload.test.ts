import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api-client', () => ({ api: {} }))

const { rejectReason } = await import('./upload')

const MB = 1024 * 1024
const file = (type: string, size: number) => ({ name: 'f', type, size }) as File

describe('rejectReason (client upload gate)', () => {
  it('matches the server: images up to 10 MB', () => {
    expect(rejectReason(file('image/jpeg', 10 * MB))).toBeNull()
    expect(rejectReason(file('image/jpeg', 10 * MB + 1))).not.toBeNull()
  })

  it('matches the server: mp4 up to 100 MB', () => {
    expect(rejectReason(file('video/mp4', 60 * MB))).toBeNull()
    expect(rejectReason(file('video/mp4', 100 * MB + 1))).not.toBeNull()
  })

  it('refuses types the server refuses', () => {
    expect(rejectReason(file('image/svg+xml', 1))).not.toBeNull()
  })
})
