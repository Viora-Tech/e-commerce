import { parseAsArrayOf, parseAsString, parseAsStringLiteral } from 'nuqs'
import {
  type DateFilterValue,
  type FilterGroup,
  facetOptions,
} from '@/components/table/filter-panel'
import type { blogListContent } from '@/data/blog'
import type { filterPanelContent } from '@/data/filter-panel'
import {
  dateFilterBounds,
  hasDateFilter,
  NO_DATE_FILTER,
  parseAsDateFilter,
} from '@/lib/date-filter'
import {
  dateGroup,
  LAST_DAYS,
  lastDaysStart,
  windowInput,
  YES_NO,
  type YesNo,
  yesNoGroup,
  yesNoInput,
} from '@/lib/list-filter-parts'

/** What the Blog posts filter panel holds; arrays are "any of", empty for no filter. */
export type BlogPostFilters = {
  /** Blog ids. */
  blog: string[]
  tag: string[]
  author: string[]
  published: DateFilterValue
  image: YesNo | null
}

export const NO_BLOG_POST_FILTERS: BlogPostFilters = {
  blog: [],
  tag: [],
  author: [],
  published: NO_DATE_FILTER,
  image: null,
}

/* Module scope, so the empty defaults keep one identity and the list effect runs once per change.
   `?blog=<id>` and `?tag=x` from older links read as one pick. */
export const BLOG_POST_FILTER_PARAMS = {
  blog: parseAsArrayOf(parseAsString).withDefault([]),
  tag: parseAsArrayOf(parseAsString).withDefault([]),
  author: parseAsArrayOf(parseAsString).withDefault([]),
  published: parseAsDateFilter(LAST_DAYS),
  image: parseAsStringLiteral(YES_NO),
}

/** Every filter cleared, as a URL patch (`null` drops the param). */
export const CLEAR_BLOG_POST_FILTERS = {
  blog: null,
  tag: null,
  author: null,
  published: null,
  image: null,
}

export function hasBlogPostFilters(f: BlogPostFilters): boolean {
  return (
    f.blog.length > 0 ||
    f.tag.length > 0 ||
    f.author.length > 0 ||
    hasDateFilter(f.published) ||
    f.image !== null
  )
}

/** The panel as `blog.list` input. */
export function blogPostFilterInput(f: BlogPostFilters, now = new Date()) {
  const image = yesNoInput(f.image)
  return {
    ...(f.blog.length ? { blogIds: f.blog } : {}),
    ...(f.tag.length ? { tags: f.tag } : {}),
    ...(f.author.length ? { authors: f.author } : {}),
    ...windowInput('published', dateFilterBounds(f.published, lastDaysStart, now)),
    ...(image === undefined ? {} : { hasImage: image }),
  }
}

type Facets = { blogs: { id: string; title: string }[]; tags: string[]; authors: string[] }

/** The panel's groups; the chips and Clear all come from the same list. */
export function blogPostFilterGroups(
  f: BlogPostFilters,
  copy: (typeof blogListContent)['filters'],
  panel: typeof filterPanelContent,
  facets: Facets,
  onChange: (patch: Partial<BlogPostFilters>) => void,
): FilterGroup[] {
  return [
    {
      key: 'blog',
      label: copy.blog,
      type: 'multi',
      options: facets.blogs.map((b) => ({ value: b.id, label: b.title })),
      value: f.blog,
      onChange: (blog) => onChange({ blog }),
    },
    {
      key: 'tag',
      label: copy.tag,
      type: 'multi',
      options: facetOptions(facets.tags),
      value: f.tag,
      onChange: (tag) => onChange({ tag }),
    },
    {
      key: 'author',
      label: copy.author,
      type: 'multi',
      options: facetOptions(facets.authors),
      value: f.author,
      onChange: (author) => onChange({ author }),
    },
    dateGroup(
      'published',
      copy.published,
      f.published,
      (published) => onChange({ published }),
      panel,
    ),
    yesNoGroup('image', copy.image, f.image, (image) => onChange({ image })),
  ]
}
