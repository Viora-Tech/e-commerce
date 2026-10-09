export const NAVIGATION_ITEM_TYPES = ['home', 'product', 'collection', 'page', 'url'] as const
export type NavigationItemType = (typeof NAVIGATION_ITEM_TYPES)[number]

/** One menu item in the editor. 'value' is the handle (product/collection/page) or the URL. */
export type MenuItem = {
  id: string
  title: string
  type: NavigationItemType
  value?: string
  /** Nested items; a menu is at most three levels deep. */
  children?: MenuItem[]
}

/** How far one nesting level indents a row, in rem. Dragging this far sideways changes level. */
export const MENU_INDENT_REM = 2

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

/** The compact "Storefront navigation" summary card beside the menus table, and the
 *  sheet its Edit button opens. */
export const storefrontContent = {
  heading: 'Storefront navigation',
  description: 'Which menus the storefront header and footer render.',
  edit: 'Edit',
  editTitle: 'Edit storefront navigation',
  editDescription: 'Choose which menu the header renders, and which fill the footer columns.',
  summaryHeaderLabel: 'Header',
  summaryFooterLabel: 'Footer',
  summaryNone: 'None set',
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
  cancel: 'Cancel',
  saved: 'Storefront navigation saved',
  failed: 'Could not save the storefront navigation',
  noMenus: 'Add a menu first. The header and footer can only render menus that exist.',
} as const

export const menusContent = {
  title: 'Menus',
  summary: (n: number, where: string) => {
    if (n === 0) return 'The links shoppers use to move around your store.'
    const count = `${n} ${n === 1 ? 'menu' : 'menus'}`
    return where ? `${count} · used in your ${where}` : count
  },
  usedInJoin: (parts: string[]) => parts.join(' and '),
  resource: { singular: 'menu', plural: 'menus' },
  add: 'Add menu',
  redirects: 'Redirects',
  headerFooter: 'Header and footer',
  columns: {
    title: 'Menu',
    handle: 'Handle',
    items: 'Links',
    usedIn: 'Used in',
    status: 'Status',
    updated: 'Updated',
  },
  status: { active: 'Active', unused: 'Not used' },
  /** Small badges on the title cell, showing where the storefront uses this menu. */
  usage: { header: 'Header', footer: 'Footer' },
  /** Lower-case place names for the summary line. */
  where: { header: 'header', footer: 'footer' },
  notUsed: 'Not used yet',
  empty: {
    heading: 'No menus yet',
    body: 'Menus drive the storefront header and footer. Add one to start.',
  },
  itemCount: (n: number) => (n === 1 ? '1 link' : `${n} links`),
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
    summary: (links: number, where: string) => {
      const count = links === 1 ? '1 link' : `${links} links`
      return where ? `${count} · shown in your store ${where}` : count
    },
    deleteMenu: 'Delete menu',
    previewHeading: 'Preview',
    previewEmpty: 'Add a link to see it here.',
    detailsHeading: 'Name and handle',
    handleLabel: 'Handle',
    handleHelp: 'Used internally, never shown to shoppers.',
    itemsHeading: 'Menu items',
    addItem: 'Add menu item',
    save: 'Save',
    discard: 'Discard',
    saving: 'Saving…',
    saved: 'Menu saved',
    failed: 'Save failed',
    unsaved: 'Unsaved changes',
    empty: 'No items yet. Add the first link below.',
    hint: 'Drag to reorder. Drag right to nest under the item above, left to lift it out.',
    addChild: (parent: string) => `Add menu item to ${parent}`,
    levelLimit: 'Menus go three levels deep.',
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
    drag: (title: string) => `Move ${title}`,
    expand: (title: string) => `Show items under ${title}`,
    collapse: (title: string) => `Hide items under ${title}`,
    carried: (n: number) => `+${n}`,
  },
  /** Screen-reader copy for moving rows, by pointer or keyboard. */
  a11y: {
    instructions:
      'To move an item, press space on its handle. Use the up and down arrows to move it, right to nest it under the item above and left to lift it out. Press space again to drop it, or escape to cancel.',
    picked: (title: string) => `Picked up ${title}.`,
    position: (title: string, position: number, total: number, level: number) =>
      `${title}, position ${position} of ${total}, level ${level}.`,
    dropped: (title: string, position: number, total: number, level: number) =>
      `Dropped ${title} at position ${position} of ${total}, level ${level}.`,
    cancelled: (title: string) => `Move cancelled. ${title} is back where it was.`,
  },
} as const
