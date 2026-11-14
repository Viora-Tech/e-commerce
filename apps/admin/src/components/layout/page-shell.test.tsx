// @vitest-environment jsdom
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import DetailPageSkeleton from '@/components/layout/detail-page-skeleton'
import PageBody from '@/components/layout/page-body'
import PageColumns from '@/components/layout/page-columns'
import ProoflyDetailPage from '@/components/layout/proofly-detail-page'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import ProoflyPageBody from '@/components/layout/proofly-page-body'
import OrderPageFrame from '@/components/orders/order-page-frame'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

/** The class list of the first element a render draws. */
function rootClass(ui: ReactElement): string {
  return render(ui).container.firstElementChild?.className ?? ''
}

describe('one page shell', () => {
  it('draws one gutter and rhythm on every page', () => {
    const body = rootClass(<PageBody>x</PageBody>)
    for (const cls of ['px-4', 'md:px-6', 'gap-6', 'pb-6', 'md:pb-8']) expect(body).toContain(cls)
    expect(body).not.toContain('max-w-')
  })

  it('centres each named width', () => {
    expect(rootClass(<PageBody width="detail">x</PageBody>)).toContain('max-w-[75rem]')
    expect(rootClass(<PageBody width="settings">x</PageBody>)).toContain('max-w-[68rem]')
    expect(rootClass(<PageBody width="form">x</PageBody>)).toContain('max-w-[52rem]')
    expect(rootClass(<PageBody width="narrow">x</PageBody>)).toContain('max-w-[48rem]')
    expect(rootClass(<PageBody width="detail">x</PageBody>)).toContain('mx-auto')
  })

  it('builds the list, detail and order frames on PageBody', () => {
    const list = rootClass(
      <ProoflyListPage title="Orders">
        <div />
      </ProoflyListPage>,
    )
    expect(list).toBe(rootClass(<PageBody>x</PageBody>))
    const detail = rootClass(<PageBody width="detail">x</PageBody>)
    expect(rootClass(<ProoflyDetailPage header={<h1>t</h1>} main={<div />} />)).toBe(detail)
    expect(rootClass(<ProoflyPageBody>x</ProoflyPageBody>)).toBe(detail)
    expect(rootClass(<DetailPageSkeleton />)).toBe(detail)
    const order = rootClass(<OrderPageFrame header={<h1>t</h1>} main={<div />} side={<div />} />)
    expect(order).toContain('max-w-[75rem]')
    expect(order).toContain('print:hidden')
  })

  it('gives every side column one width and drops it when there is none', () => {
    expect(rootClass(<PageColumns main={<div />} side={<div />} />)).toContain(
      'lg:grid-cols-[minmax(0,1fr)_23.5rem]',
    )
    expect(rootClass(<PageColumns main={<div />} />)).not.toContain('grid-cols-[')
  })
})
