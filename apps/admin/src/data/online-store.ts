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
  form: {
    back: 'Pages',
    /** Opened from an SEO issue's Edit (audit #176). */
    backSeo: 'SEO',
    title: 'Title',
    content: 'Content',
    unsaved: 'Unsaved changes',
    save: 'Save',
    saving: 'Saving',
    discard: 'Discard',
    saved: 'Page saved',
    failed: 'Could not save the page',
    viewLive: 'View on store',
    seo: {
      heading: 'Search engine listing',
      handle: 'URL handle',
      seoTitle: 'Page title',
      seoDescription: 'Meta description',
      help: 'Leave blank to use the page title and content.',
    },
    visibility: {
      heading: 'Visibility',
      visible: 'Visible',
      hidden: 'Hidden',
      visibleHelp: 'Shoppers can open this page.',
      hiddenHelp: 'Only Customize can preview this page.',
    },
    template: {
      heading: 'Theme template',
      default: 'Default page',
      help: 'The live theme lays the page out with this template.',
      editContent: 'Edit content',
      editHelp: 'Opens the template in Customize to arrange its sections.',
      /** In place of an empty Content box on a template page (audit #145). */
      inTemplate: (name: string) =>
        `This page's content comes from its theme template "${name}". Edit it in Customize.`,
      writeHere: 'Write text here instead',
    },
  },
} as const
