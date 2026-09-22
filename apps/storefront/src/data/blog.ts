/** Every string the storefront blog pages show. */
export const blogContent = {
  home: 'Home',
  allPosts: 'All posts',
  empty: 'No posts here yet.',
  emptyTag: (tag: string) => `No posts tagged ${tag} yet.`,
  filterLabel: 'Filter posts by tag',
  previous: 'Previous',
  next: 'Next',
  pageOf: (page: number, pages: number) => `Page ${page} of ${pages}`,
  by: (author: string) => `By ${author}`,
  readingTime: (minutes: number) => `${minutes} min read`,
  tagged: 'Tagged',
  olderPost: 'Older post',
  newerPost: 'Newer post',
  backTo: (blog: string) => `Back to ${blog}`,
  share: {
    label: 'Share',
    x: 'Share on X',
    facebook: 'Share on Facebook',
    whatsapp: 'Share on WhatsApp',
    email: 'Share by email',
  },
} as const

export const BLOG_PER_PAGE = 12
