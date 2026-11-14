import { cn } from '@commerce/ui/lib/utils'
import { describe, expect, it } from 'vitest'
import { BESIDE_SIDEBAR, SIDEBAR_WIDTH, SIDEBAR_WIDTH_ICON } from './sidebar-motion'

describe('BESIDE_SIDEBAR (bottom drawers start beside the rail)', () => {
  it('offsets by the expanded and collapsed rail widths, from md up only', () => {
    expect(BESIDE_SIDEBAR).toContain(`[data-state=expanded])_&]:left-[${SIDEBAR_WIDTH}]`)
    expect(BESIDE_SIDEBAR).toContain(`[data-state=collapsed])_&]:left-[${SIDEBAR_WIDTH_ICON}]`)
    for (const cls of BESIDE_SIDEBAR.split(' ')) expect(cls.startsWith('md:')).toBe(true)
  })

  it('survives class merging with the drawer popup classes', () => {
    const merged = cn('data-[swipe-axis=y]:inset-x-0 mx-auto max-w-[90rem]', BESIDE_SIDEBAR)
    for (const cls of BESIDE_SIDEBAR.split(' ')) expect(merged).toContain(cls)
    expect(merged).toContain('data-[swipe-axis=y]:inset-x-0')
  })
})
