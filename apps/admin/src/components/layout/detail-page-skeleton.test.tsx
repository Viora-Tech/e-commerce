// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import DetailPageSkeleton from '@/components/layout/detail-page-skeleton'
import ProoflyDetailPage from '@/components/layout/proofly-detail-page'
import ProoflyPageBody from '@/components/layout/proofly-page-body'
import SectionPageSkeleton from '@/components/layout/section-page-skeleton'

describe('detail page skeleton', () => {
  it('draws its cards as the real card (DataCard), main then side', () => {
    const { container } = render(<DetailPageSkeleton main={3} side={2} />)
    expect(container.querySelectorAll('[data-slot="card"]')).toHaveLength(5)
  })

  it('sits in the loaded page frame', () => {
    const detail = render(<DetailPageSkeleton />).container.firstElementChild
    const real = render(<ProoflyDetailPage header={null} main={null} />).container.firstElementChild
    expect(detail?.className).toBe(real?.className)
    const page = render(<DetailPageSkeleton frame="page" />).container.firstElementChild
    const realPage = render(<ProoflyPageBody>{null}</ProoflyPageBody>).container.firstElementChild
    expect(page?.className).toBe(realPage?.className)
  })

  it('draws no side column when asked, and a summary strip when asked', () => {
    const { container } = render(<DetailPageSkeleton frame="narrow" main={2} side={0} strip={3} />)
    expect(container.querySelectorAll('[data-slot="card"]')).toHaveLength(2)
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
  })
})

describe('section page skeleton', () => {
  it('draws the asked cards and fields', () => {
    const { container } = render(<SectionPageSkeleton cards={3} fields={2} header={false} />)
    const cards = container.querySelectorAll('[data-slot="card"]')
    expect(cards).toHaveLength(3)
    expect(cards[0]?.querySelectorAll('.h-9.w-full')).toHaveLength(2)
  })
})
