// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ContentHubSkeleton from '@/components/content/content-hub-skeleton'
import MediaLibrarySkeleton from '@/components/media/media-library-skeleton'
import { blogListContent } from '@/data/blog'
import { contentContent } from '@/data/content'
import { discountsContent } from '@/data/discounts'
import { mediaContent } from '@/data/media'
import { menusContent } from '@/data/menus'
import { entryListContent, metaobjectListContent } from '@/data/metaobjects'
import { redirectsContent } from '@/data/redirects'
import DiscountsSkeleton from '../discounts/discounts-skeleton'
import BlogPostsSkeleton from './blog-posts/blog-posts-skeleton'
import MenusSkeleton from './menus/menus-skeleton'
import RedirectsSkeleton from './menus/redirects/redirects-skeleton'
import EntriesSkeleton from './metaobjects/[type]/entries-skeleton'
import DefinitionsSkeleton from './metaobjects/definitions-skeleton'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/content',
  useSearchParams: () => new URLSearchParams(),
}))

/** The header text of the skeleton's table. */
function headText(root: HTMLElement): string {
  return root.querySelector('thead')?.textContent ?? ''
}

describe('discounts and content list skeletons', () => {
  it('Discounts: real title, four tiles and the discount columns', () => {
    const { container } = render(<DiscountsSkeleton />)
    expect(container.querySelector('h1')?.textContent).toBe(discountsContent.title)
    expect(container.querySelector('.grid[aria-busy="true"]')?.children.length).toBe(4)
    expect(headText(container)).toContain(discountsContent.columns.title)
  })

  it('Blog posts, menus and content types: real title, no tiles, the real columns', () => {
    const cases = [
      [<BlogPostsSkeleton key="b" />, blogListContent.heading, blogListContent.columns.title],
      [<MenusSkeleton key="m" />, menusContent.title, menusContent.columns.usedIn],
      [
        <DefinitionsSkeleton key="d" />,
        metaobjectListContent.heading,
        metaobjectListContent.columns.entries,
      ],
    ] as const
    for (const [node, heading, column] of cases) {
      const { container, unmount } = render(node)
      expect(container.querySelector('h1')?.textContent).toBe(heading)
      expect(container.querySelector('.grid[aria-busy="true"]')).toBeNull()
      expect(headText(container)).toContain(column)
      unmount()
    }
  })

  it('Redirects and entries: the detail shell with the real table columns', () => {
    const redirects = render(<RedirectsSkeleton />)
    expect(redirects.container.textContent).toContain(redirectsContent.title)
    expect(headText(redirects.container)).toContain(redirectsContent.columns.target)
    redirects.unmount()
    const entries = render(<EntriesSkeleton />)
    expect(headText(entries.container)).toContain(entryListContent.columns.status)
  })

  it('Content hub and Files: real titles, the four hub cards and the tile grid', () => {
    const hub = render(<ContentHubSkeleton />)
    expect(hub.container.querySelector('h1')?.textContent).toBe(contentContent.title)
    expect(hub.container.querySelector('.grid[aria-busy="true"]')?.children.length).toBe(4)
    hub.unmount()
    const files = render(<MediaLibrarySkeleton />)
    expect(files.container.querySelector('h1')?.textContent).toBe(mediaContent.library.title)
    expect(files.container.querySelectorAll('li').length).toBe(10)
  })
})
