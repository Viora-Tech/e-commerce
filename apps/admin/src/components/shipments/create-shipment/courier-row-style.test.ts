import { describe, expect, it } from 'vitest'
import { courierCardClass, courierRowClass } from './courier-row-style'

describe('courier row states', () => {
  it('a picked table row keeps its picked colour under the pointer (no hover class)', () => {
    expect(courierRowClass(true, false)).toContain('bg-primary-soft')
    expect(courierRowClass(true, false)).not.toContain('hover:')
  })

  it('only unpicked, bookable rows highlight on hover', () => {
    expect(courierRowClass(false, false)).toContain('hover:bg-row-hover')
    expect(courierRowClass(false, true)).not.toContain('hover:')
  })

  it('a selected card keeps its primary border under the pointer', () => {
    expect(courierCardClass(true, false)).toContain('border-primary')
    expect(courierCardClass(true, false)).not.toContain('hover:')
    expect(courierCardClass(false, false)).toContain('hover:border-border-strong')
    expect(courierCardClass(false, true)).not.toContain('hover:')
  })
})
