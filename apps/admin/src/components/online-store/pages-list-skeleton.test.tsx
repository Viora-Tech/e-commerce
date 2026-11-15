// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ResourceTable from '@/components/table/resource-table'
import { pagesListContent } from '@/data/content'
import { pageColumns } from './page-columns'
import PagesListSkeleton from './pages-list-skeleton'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const fmt = {
  dateTime: (v: unknown) => String(v),
  when: (v: unknown) => String(v),
} as unknown as Parameters<typeof pageColumns>[1]

/** The class list of every header cell, in order. */
function headClasses(root: HTMLElement): string[] {
  return [...root.querySelectorAll('thead th')].map((th) => th.className)
}

describe('Pages list skeleton', () => {
  it('has the same header cells as the loaded Pages table', () => {
    const skeleton = render(<PagesListSkeleton />).container
    const loaded = render(
      <ResourceTable
        resourceName={pagesListContent.resource}
        columns={pageColumns(pagesListContent, fmt)}
        items={[]}
        getId={(p) => p.id}
        href={() => ''}
        rowActions={() => null}
        query=""
        onQueryChange={() => undefined}
        page={1}
        perPage={25}
        total={0}
        onPageChange={() => undefined}
        selectable={false}
      />,
    ).container

    const heads = headClasses(skeleton)
    expect(heads.length).toBeGreaterThan(3)
    expect(heads).toEqual(headClasses(loaded))
    expect(skeleton.querySelector('thead')?.textContent).toBe(
      loaded.querySelector('thead')?.textContent,
    )
  })

  it('draws the real title', () => {
    const { container } = render(<PagesListSkeleton />)
    expect(container.querySelector('h1')?.textContent).toBe(pagesListContent.title)
  })
})
