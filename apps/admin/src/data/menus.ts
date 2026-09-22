export const NAVIGATION_ITEM_TYPES = ['home', 'product', 'collection', 'page', 'url'] as const
export type NavigationItemType = (typeof NAVIGATION_ITEM_TYPES)[number]

/** One menu item in the editor. 'value' is the handle (product/collection/page) or the URL. */
export type MenuItem = {
  id: string
  title: string
  type: NavigationItemType
  value?: string
}

export type MenuListItem = {
  id: string
  title: string
  handle: string
  itemCount: number
  updatedAt: Date | string
}

/** The storefront path a menu item points at, for the editor's 'links to' line. */
export function destinationPath(type: NavigationItemType, value?: string): string {
  switch (type) {
    case 'home':
      return '/'
    case 'product':
      return `/products/${value ?? ''}`
    case 'collection':
      return `/collections/${value ?? ''}`
    case 'page':
      return `/pages/${value ?? ''}`
    case 'url':
      return value ?? ''
  }
}

/** The header/footer assignment card above the menu list. */
export const storefrontContent = {
  heading: 'Storefront navigation',
  description: 'Which menus the storefront header and footer render.',
  headerLabel: 'Header menu',
  headerHelp: 'The main navigation across every storefront page.',
  none: 'None',
  footerLabel: 'Footer columns',
  footerHelp: 'Each column renders a menu, headed by the menu title.',
  addColumn: 'Add column',
  removeColumn: 'Remove column',
  moveUp: 'Move column up',
  moveDown: 'Move column down',
  save: 'Save',
  saved: 'Storefront navigation saved',
  failed: 'Could not save the storefront navigation',
  noMenus: 'Add a menu first — the header and footer can only render menus that exist.',
} as const

export const menusContent = {
  title: 'Menus',
  add: 'Add menu',
  columns: { title: 'Menu', handle: 'Handle', items: 'Items', updated: 'Updated' },
  empty: {
    heading: 'No menus yet',
    body: 'Menus drive the storefront header and footer. Add one to start.',
  },
  itemCount: (n: number) => (n === 1 ? '1 item' : `${n} items`),
  /** The row actions menu on the menus table. */
  actions: {
    label: 'Menu actions',
    rename: 'Rename',
    delete: 'Delete',
  },
  rename: {
    title: 'Rename menu',
    label: 'Menu title',
    cancel: 'Cancel',
    confirm: 'Save',
    saving: 'Saving…',
    saved: 'Menu renamed',
    failed: 'Could not rename the menu',
  },
  remove: {
    title: 'Delete menu',
    body: (name: string) =>
      `Delete “${name}”? The storefront stops showing it immediately. This cannot be undone.`,
    cancel: 'Cancel',
    confirm: 'Delete',
    busy: 'Deleting…',
    done: 'Menu deleted',
    failed: 'Could not delete the menu',
  },
  create: {
    title: 'Add menu',
    titleLabel: 'Menu title',
    handleLabel: 'Handle',
    handlePrefix: '/menus/',
    handleHelp: 'Lowercase, no spaces. Used internally, never shown to shoppers.',
    cancel: 'Cancel',
    confirm: 'Create',
    failed: 'Could not create the menu',
  },
  editor: {
    back: 'Menus',
    itemsHeading: 'Menu items',
    addItem: 'Add menu item',
    save: 'Save',
    saving: 'Saving…',
    saved: 'Menu saved',
    failed: 'Save failed',
    unsaved: 'Unsaved changes',
    empty: 'No items yet. Add the first link below.',
    hint: 'The top item appears first. Use the arrows to reorder.',
    storefrontNote: 'The storefront renders this menu wherever the header or footer points at it.',
  },
  item: {
    title: 'Menu item',
    titleLabel: 'Title',
    titlePlaceholder: 'Shop all',
    destinationLabel: 'Link to',
    add: 'Add',
    update: 'Update',
    cancel: 'Cancel',
    types: {
      home: 'Home',
      product: 'Product',
      collection: 'Collection',
      page: 'Page',
      url: 'Custom URL',
    } satisfies Record<NavigationItemType, string>,
    urlPlaceholder: 'https:// or /path',
    searchPlaceholder: 'Search',
    noResults: 'Nothing matches',
    missingTitle: 'Give the item a title',
    missingValue: 'Choose a destination',
    moveUp: 'Move up',
    moveDown: 'Move down',
    edit: 'Edit item',
    remove: 'Remove item',
  },
} as const
