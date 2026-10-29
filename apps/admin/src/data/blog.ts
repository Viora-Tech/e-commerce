import type { ArticleStatus, CommentPolicy } from '@commerce/core/blog'

export const ARTICLE_TABS = ['published', 'scheduled', 'draft'] as const
export type ArticleTab = (typeof ARTICLE_TABS)[number]

const status: Record<ArticleStatus, string> = {
  published: 'Published',
  scheduled: 'Scheduled',
  draft: 'Draft',
}

export const blogListContent = {
  heading: 'Blog posts',
  add: 'Write post',
  summary: (all: number, live: number, scheduled: number, drafts: number) => {
    if (all === 0) return 'Stories, launches and guides for your shoppers.'
    const parts = [`${all} ${all === 1 ? 'post' : 'posts'}`]
    if (live > 0) parts.push(`${live} live`)
    if (scheduled > 0) parts.push(`${scheduled} scheduled`)
    if (drafts > 0) parts.push(`${drafts} ${drafts === 1 ? 'draft' : 'drafts'}`)
    return parts.join(' · ')
  },
  manageBlogs: 'Manage blogs',
  resource: { singular: 'blog post', plural: 'blog posts' },
  none: 'None',
  columns: {
    title: 'Title',
    blog: 'Blog',
    status: 'Status',
    author: 'Author',
    published: 'Published',
  },
  tabs: { all: 'All', published: 'Published', scheduled: 'Scheduled', draft: 'Drafts' },
  status,
  scheduledFor: (when: string) => `Scheduled ${when}`,
  filters: {
    blog: 'Blog',
    tag: 'Tag',
    any: 'Any',
    author: 'Author',
    published: 'Published',
    image: 'Has a featured image',
  },
  noResults: {
    heading: 'No posts match these filters',
    body: 'Try a different search or clear the filters.',
  },
  bulk: {
    publish: 'Publish',
    unpublish: 'Unpublish',
    delete: 'Delete',
    published: (n: number) => `${n} ${n === 1 ? 'post' : 'posts'} published`,
    unpublished: (n: number) => `${n} ${n === 1 ? 'post' : 'posts'} moved to drafts`,
    deleted: (n: number) => `${n} ${n === 1 ? 'post' : 'posts'} deleted`,
    failed: 'That did not work. Try again',
    confirmDelete: {
      title: (n: number) => `Delete ${n} ${n === 1 ? 'blog post' : 'blog posts'}?`,
      body: 'Deleted posts are removed from your storefront and cannot be recovered.',
      cancel: 'Cancel',
      confirm: 'Delete',
    },
  },
  row: {
    open: 'Open post',
    publish: 'Publish',
    unpublish: 'Unpublish',
    view: 'View on store',
    delete: 'Delete',
    deleteTitle: (title: string) => `Delete ${title}?`,
  },
  empty: {
    heading: 'Write your first blog post',
    body: 'Posts publish to your storefront blog and help search engines find you for the topics your shoppers care about.',
  },
} as const

export const articleFormContent = {
  newTitle: 'Add blog post',
  editTitle: 'Edit blog post',
  back: 'Blog posts',
  save: 'Save',
  saving: 'Saving…',
  discard: 'Discard',
  unsaved: 'Unsaved blog post',
  created: 'Blog post created',
  saved: 'Blog post saved',
  deletedToast: 'Blog post deleted',
  saveFailed: 'Could not save the blog post',
  titleRequired: 'Give the post a title',
  viewLive: 'View on store',
  main: {
    title: 'Title',
    titlePlaceholder: 'e.g. Blog about your latest products or deals',
    content: 'Content',
    excerpt: 'Excerpt',
    excerptHelp:
      'Shown on the blog page and in search results. Leave empty to use the start of the post.',
  },
  visibility: {
    heading: 'Visibility',
    published: 'Visible',
    scheduled: 'Scheduled',
    draft: 'Hidden',
    publishedHelp: (when: string | null) =>
      when ? `Published ${when}` : 'Publishes when you save',
    scheduledHelp: 'The post goes live on the storefront at this time.',
    draftHelp: 'Only staff can see hidden posts.',
    when: 'Publish date',
    tz: 'Times are in your browser time zone.',
  },
  image: {
    heading: 'Image',
    pick: 'Add image',
    change: 'Change',
    remove: 'Remove',
    alt: 'Alt text',
    altHelp: 'Describe the image for screen readers and search engines.',
    empty: 'Upload images in Content > Files first.',
  },
  organisation: {
    heading: 'Organization',
    blog: 'Blog',
    createBlog: 'Create blog',
    author: 'Author',
    tags: 'Tags',
    tagsPlaceholder: 'Find or create tags',
  },
  seo: {
    heading: 'Search engine listing',
    edit: 'Edit',
    previewHint:
      'Add a title and content to see how this post might appear in a search engine listing.',
    title: 'Page title',
    titleHelp: (n: number) => `${n} of 70 characters used`,
    description: 'Meta description',
    descriptionHelp: (n: number) => `${n} of 320 characters used`,
    handle: 'URL handle',
  },
  delete: {
    action: 'Delete blog post',
    heading: 'Delete this blog post?',
    body: 'It is removed from your storefront and cannot be recovered.',
    cancel: 'Cancel',
    confirm: 'Delete',
  },
} as const

const commentPolicy: Record<CommentPolicy, string> = {
  disabled: 'Off',
  moderated: 'On, after you approve',
  open: 'On, published right away',
}

export const blogsManageContent = {
  heading: 'Manage blogs',
  back: 'Blog posts',
  add: 'Create blog',
  posts: (n: number) => `${n} ${n === 1 ? 'post' : 'posts'}`,
  edit: 'Edit',
  delete: 'Delete',
  commentPolicy,
  dialog: {
    createTitle: 'Create blog',
    editTitle: 'Edit blog',
    title: 'Title',
    titlePlaceholder: 'e.g. News, Guides',
    handle: 'URL handle',
    handleHelp: 'Leave empty to build it from the title.',
    comments: 'Comments',
    template: 'Theme template',
    cancel: 'Cancel',
    save: 'Save',
    saving: 'Saving…',
  },
  created: 'Blog created',
  saved: 'Blog saved',
  deleted: 'Blog deleted',
  failed: 'Could not save the blog',
  confirmDelete: {
    title: (name: string) => `Delete ${name}?`,
    body: 'Only a blog with no posts can be deleted.',
    hasPosts: (n: number) =>
      `This blog has ${n} ${n === 1 ? 'post' : 'posts'}. Move or delete them before deleting the blog.`,
    cancel: 'Cancel',
    confirm: 'Delete',
  },
} as const
