import { describe, expect, it } from 'vitest'
import { courierRowClass } from './courier-row-style'

describe('courier row states', () => {
  it('a picked table row keeps its picked colour under the pointer (no hover class)', () => {
    expect(courierRowClass(true, false)).toContain('bg-primary-soft')
    expect(courierRowClass(true, false)).not.toContain('hover:')
  })

  it('only unpicked, bookable rows highlight on hover', () => {
    expect(courierRowClass(false, false)).toContain('hover:bg-row-hover')
    expect(courierRowClass(false, true)).not.toContain('hover:')
  })
})
