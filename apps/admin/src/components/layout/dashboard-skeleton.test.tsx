// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  HERO_SHELL,
  HOME_NARROW,
  HOME_RHYTHM,
  HOME_SPLIT,
  LATEST_ROWS,
  TILE_BOX,
  TILE_GRID,
} from '@/components/home/home-layout'
import SalesMetricTiles from '@/components/home/sales-metric-tiles'
import DashboardSkeleton from '@/components/layout/dashboard-skeleton'
import PageBody from '@/components/layout/page-body'

/** Every element whose class list holds all of `classes`. */
function withClasses(root: ParentNode, classes: string): Element[] {
  const selector = classes
    .split(' ')
    .map((c) => `.${CSS.escape(c)}`)
    .join('')
  return [...root.querySelectorAll(selector)]
}

describe('home skeleton', () => {
  it('uses Home’s page frame: the 68rem shell with its 2.5rem rhythm', () => {
    const skeleton = render(<DashboardSkeleton />).container.firstElementChild
    const page = render(
      <PageBody width="settings" className={HOME_RHYTHM}>
        <div />
      </PageBody>,
    ).container.firstElementChild
    expect(skeleton?.className).toBe(page?.className)
    expect(skeleton?.className).toContain('max-w-[68rem]')
  })

  it('draws the 48rem greeting column, the hero card and the 640:424 split', () => {
    const { container } = render(<DashboardSkeleton />)
    expect(withClasses(container, HOME_NARROW)).toHaveLength(1)
    expect(withClasses(container, HOME_NARROW)[0]?.className).toContain('max-w-[48rem]')
    expect(withClasses(container, HERO_SHELL)).toHaveLength(1)
    expect(withClasses(container, HOME_SPLIT)).toHaveLength(1)
  })

  it('draws four metric tiles in the real tile boxes and five order rows', () => {
    const { container } = render(<DashboardSkeleton />)
    const grid = withClasses(container, TILE_GRID)[0]
    expect(grid?.children).toHaveLength(4)
    expect(withClasses(container, TILE_BOX)).toHaveLength(4)
    const split = withClasses(container, HOME_SPLIT)[0]
    expect(split?.querySelectorAll('.divide-y > div')).toHaveLength(LATEST_ROWS)
  })

  it('shares its tile boxes with the loaded metric tiles', () => {
    const { container } = render(
      <SalesMetricTiles
        tiles={['sales', 'orders'].map((m) => ({
          metric: m as 'sales' | 'orders',
          label: m,
          display: '₹1,000',
          spark: [1, 2, 3],
          change: 5,
          unit: '%',
        }))}
        comparedTo="vs yesterday"
        metric="sales"
        onSelect={() => {}}
        customizing={false}
        onSwap={() => {}}
      />,
    )
    expect(container.firstElementChild?.className).toBe(TILE_GRID)
    expect(withClasses(container, TILE_BOX)).toHaveLength(2)
    expect(container.querySelector('.text-stat-md')).toBeTruthy()
  })
})
