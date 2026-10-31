import { describe, expect, it } from 'vitest'
import { MODEL_TIERS, modelLabel } from '../src/features'

describe('modelLabel (#114)', () => {
  it('reads a gateway id as a plain name', () => {
    expect(modelLabel('anthropic/claude-haiku-5.5')).toBe('Claude Haiku 5.5')
    expect(modelLabel('claude-sonnet-5-5')).toBe('Claude Sonnet 5.5')
  })
  it('names every configured tier without a slash', () => {
    for (const id of Object.values(MODEL_TIERS)) expect(modelLabel(id)).not.toContain('/')
  })
})
