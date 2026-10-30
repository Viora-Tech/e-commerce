/** Copy for the Content hub and the Pages list (the other Content screens have their own files). */
export const contentContent = {
  title: 'Content',
  summary: 'Files, menus and structured content used across your storefront.',
  cards: {
    files: {
      title: 'Files',
      body: 'Photos, videos and documents you use on pages and products.',
      open: 'Open files',
      count: (n: number) => (n === 1 ? '1 file' : `${n} files`),
      none: 'No files yet',
    },
    contentTypes: {
      title: 'Content types',
      body: 'Structured content with its own fields, shown anywhere in your theme.',
      open: 'Open content types',
      count: (n: number, names: string) => (n === 1 ? `1 type: ${names}` : `${n} types: ${names}`),
      none: 'No content types yet',
    },
    menus: {
      title: 'Menus',
      body: 'The links shoppers use to move around your store.',
      open: 'Open menus',
      count: (n: number, names: string) => (n === 1 ? `1 menu: ${names}` : `${n} menus: ${names}`),
      none: 'No menus yet',
    },
    blogPosts: {
      title: 'Blog posts',
      body: 'Stories, launches and guides that bring people to your shop.',
      open: 'Open blog posts',
      count: (posts: number, drafts: number) => {
        const base = posts === 1 ? '1 post' : `${posts} posts`
        return drafts > 0 ? `${base} · ${drafts} ${drafts === 1 ? 'draft' : 'drafts'}` : base
      },
      none: 'No posts yet',
    },
  },
} as const

export const pagesListContent = {
  title: 'Pages',
  summary: (total: number, live: number, hidden: number) => {
    if (total === 0) return 'Pages like About us, Contact and FAQs.'
    const parts = [`${total} ${total === 1 ? 'page' : 'pages'}`]
    if (live > 0) parts.push(`${live} live on your store`)
    if (hidden > 0) parts.push(`${hidden} hidden`)
    return parts.join(' · ')
  },
  add: 'Add page',
  open: 'Open page',
  row: {
    show: 'Show on store',
    hide: 'Hide',
    shown: 'Page is now live on your store',
    hidden: 'Page hidden',
    view: 'View on store',
    delete: 'Delete',
    deleted: 'Page deleted',
    deleteTitle: (title: string) => `Delete ${title}?`,
    deleteBody: 'The page leaves your store and links to it stop working. This cannot be undone.',
    deleteConfirm: 'Delete',
    cancel: 'Cancel',
    failed: 'That did not work. Try again',
  },
  search: 'Search pages',
  resource: { singular: 'page', plural: 'pages' },
  tabs: { all: 'All', live: 'Published', hidden: 'Hidden' },
  columns: { title: 'Title', template: 'Template', visibility: 'Visibility', updated: 'Updated' },
  template: { default: 'Default page' },
  /** Refund, privacy, terms, shipping and contact pages: Settings › Policies edits them (#133). */
  policy: 'Policy',
  visibility: { live: 'Published', hidden: 'Hidden' },
  empty: {
    heading: 'No pages yet',
    body: 'Add a page to start building with the editor.',
  },
  noMatch: { heading: 'No pages match', body: 'Try a different search or tab.' },
} as const
