import { describe, expect, it, vi } from 'vitest'
import { retryOnce } from './retry-once'

describe('retryOnce', () => {
  it('returns the first answer without trying again', async () => {
    const run = vi.fn().mockResolvedValue('ok')
    await expect(retryOnce(run)).resolves.toBe('ok')
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('tries once more after a failure', async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error('503')).mockResolvedValue('ok')
    await expect(retryOnce(run)).resolves.toBe('ok')
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('gives the second failure to the caller', async () => {
    const run = vi.fn().mockRejectedValue(new Error('503'))
    await expect(retryOnce(run)).rejects.toThrow('503')
    expect(run).toHaveBeenCalledTimes(2)
  })
})
