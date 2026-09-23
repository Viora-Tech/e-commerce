import type { TemplateKey } from '@commerce/core/theme'
import type { SortableListLabels } from '@commerce/ui/sortable'

/** Copy for Online Store › Themes › Customize: templates, the sections tree and the inspector. */
export const customizeContent = {
  tabs: { sections: 'Sections', settings: 'Theme settings' },
  templates: {
    label: 'Template',
    default: 'Default',
    create: 'Create template',
    names: {
      home: 'Home page',
      product: 'Products',
      collection: 'Collections',
      page: 'Pages',
      blog: 'Blogs',
      article: 'Blog posts',
      cart: 'Cart',
      search: 'Search',
      not_found: '404 page',
      header: 'Header',
      footer: 'Footer',
    } satisfies Record<TemplateKey, string>,
    alternate: (kind: string, suffix: string) => `${kind}: ${suffix}`,
  },
  createDialog: {
    title: 'Create template',
    body: 'A new template starts as a copy of the one you choose. Assign it to products, collections or pages from their own settings.',
    kind: 'Template type',
    name: 'Name',
    nameHelp: 'Lowercase letters, numbers and hyphens, for example preorder.',
    basedOn: 'Based on',
    cancel: 'Cancel',
    confirm: 'Create template',
    created: 'Template created',
    failed: 'Could not create the template',
  },
  resource: {
    label: 'Preview',
    product: 'Choose a product',
    collection: 'Choose a collection',
    page: 'Choose a page',
    search: 'Search',
    empty: 'Nothing to preview yet',
  },
  groups: { header: 'Header', template: 'Template', footer: 'Footer' },
  tree: {
    add: 'Add section',
    select: (name: string) => `Select ${name}`,
    hide: (name: string) => `Hide ${name}`,
    show: (name: string) => `Show ${name}`,
    duplicate: (name: string) => `Duplicate ${name}`,
    remove: (name: string) => `Remove ${name}`,
    hidden: 'Hidden',
    locked: 'This section shows the page content and cannot be removed',
  },
  addSection: {
    search: 'Search sections',
    empty: 'No sections match',
    title: 'Add section',
  },
  inspector: {
    empty: 'Select a section to edit its settings.',
    emptyFields: 'This section has no settings.',
    label: 'Section settings',
  },
  bar: {
    undo: 'Undo',
    redo: 'Redo',
    save: 'Save',
    saved: 'Saved',
    saveFailed: 'Could not save your changes',
    unsaved: 'Unsaved changes',
    upToDate: 'All changes saved',
    draftFailed: 'Could not keep your draft. Check your connection.',
    discard: 'Discard',
    discarded: 'Changes discarded',
  },
  image: { choose: 'Choose image', change: 'Change', remove: 'Remove', dialog: 'Choose an image' },
  assign: {
    heading: 'Theme template',
    default: { product: 'Default product', collection: 'Default collection' },
    help: 'Alternates are created in Customize from the template menu.',
  },
  preview: {
    mainPlaceholder: (name: string) => `${name} appear here`,
    pickResource: 'Choose what to preview from the bar above.',
  },
} as const

export const sectionSortLabels: SortableListLabels = {
  instructions: 'Press space to pick up a section, arrow keys to move it, space again to drop it.',
  handle: (title) => `Move ${title}`,
  picked: (title) => `Picked up ${title}`,
  moved: (title, position, total) => `${title} moved to position ${position} of ${total}`,
  dropped: (title, position, total) => `${title} dropped at position ${position} of ${total}`,
  cancelled: (title) => `Move of ${title} cancelled`,
}
