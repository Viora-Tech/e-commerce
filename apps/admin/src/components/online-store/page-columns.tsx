import { POLICY_TYPES } from '@commerce/core/policies'
import StatusChip from '@/components/layout/status-chip'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import type { pagesListContent } from '@/data/content'
import type { useFormat } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'

export type PageItem = Awaited<ReturnType<typeof api.pages.list>>[number]

type PagesCopy = typeof pagesListContent

/** The page's address on the storefront: the home page is `/`. */
export const pageUrl = (handle: string) => (handle === 'home' ? '/' : `/pages/${handle}`)

/** "landing-page" becomes "Landing page"; no suffix is the theme's default template. */
const templateName = (suffix: string | null, fallback: string) => {
  if (!suffix) return fallback
  const words = suffix.replace(/-/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * The Pages list's columns (title with its address, template, visibility, updated), shared by the
 * list and its loading skeleton so the header and widths match. `copy` is the member's language.
 */
export function pageColumns(
  copy: PagesCopy,
  fmt: ReturnType<typeof useFormat>,
): ResourceColumnSpec<PageItem>[] {
  return [
    {
      id: 'title',
      title: copy.columns.title,
      sortValue: (p) => p.title,
      hideable: false,
      render: (p) => (
        <span className="flex min-w-0 flex-col">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-ink-strong">{p.title}</span>
            {/* Policies sat among the store's own pages unmarked (audit #133). */}
            {(POLICY_TYPES as readonly string[]).includes(p.handle) ? (
              <StatusChip tone="neutral" variant="outline">
                {copy.policy}
              </StatusChip>
            ) : null}
          </span>
          <span className="truncate text-caption text-muted-foreground">{pageUrl(p.handle)}</span>
        </span>
      ),
    },
    {
      id: 'template',
      title: copy.columns.template,
      sortValue: (p) => p.templateSuffix ?? '',
      render: (p) => templateName(p.templateSuffix, copy.template.default),
    },
    {
      id: 'visibility',
      title: copy.columns.visibility,
      sortValue: (p) => (p.publishedAt ? 1 : 0),
      render: (p) => (
        <StatusChip tone={p.publishedAt ? 'success' : 'neutral'}>
          {p.publishedAt ? copy.visibility.live : copy.visibility.hidden}
        </StatusChip>
      ),
    },
    {
      id: 'updated',
      title: copy.columns.updated,
      sortValue: (p) => new Date(p.updatedAt),
      render: (p) => <span title={fmt.dateTime(p.updatedAt)}>{fmt.when(p.updatedAt)}</span>,
    },
  ]
}
