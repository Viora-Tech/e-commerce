/** Copy for the Online Store sales channel. */
export const onlineStoreContent = {
  pages: {
    title: 'Pages',
    add: 'Add page',
    search: 'Search pages',
    columns: { title: 'Title', url: 'URL', status: 'Status', updated: 'Updated' },
    status: { published: 'Published', draft: 'Draft' },
    empty: { heading: 'No pages yet', body: 'Add a page to start building with the editor.' },
    create: {
      title: 'Add page',
      titleLabel: 'Title',
      handleLabel: 'URL handle',
      handlePrefix: '/pages/',
      handleHelp: "Leave blank to derive from the title. Use 'home' for the home page.",
      cancel: 'Cancel',
      confirm: 'Create',
      failed: 'Could not create the page',
    },
  },
  editor: {
    back: 'Pages',
    saveDraft: 'Save draft',
    publish: 'Publish',
    saving: 'Saving…',
    savedDraft: 'Draft saved',
    published: 'Published',
    failed: 'Save failed',
    unsaved: 'Unsaved changes',
    viewLive: 'View on store',
  },
  blog: {
    heading: 'No blog posts',
    body: 'Posts publish to your storefront blog and help search engines find you for the topics your shoppers care about.',
    action: { label: 'Edit pages', href: '/online-store/pages' },
  },
} as const
