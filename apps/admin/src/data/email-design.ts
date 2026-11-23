/**
 * Copy for Settings → Notifications → Edit design: the drag-and-drop editor for one
 * transactional email (order placed, shipped, sign-in code...). Plain words for a shop owner.
 */

export type DesignPaletteType =
  | 'logo'
  | 'heading'
  | 'text'
  | 'image'
  | 'button'
  | 'divider'
  | 'spacer'
  | 'social'
  | 'help'
  | 'footer'
  | 'hero'
  | 'products'
  | 'coupon'
  | 'video'
  | 'html'
  | 'columns'

export const emailDesignContent = {
  row: {
    edit: 'Edit design',
    customised: 'Own design',
  },
  editor: {
    title: (name: string) => `Edit design: ${name}`,
    help: 'Drag blocks to change the order. Click a block to change its words and look. Order details always show the real order.',
    loading: 'Loading the design…',
    loadFailed: 'Could not load the design',
    save: 'Save design',
    saving: 'Saving…',
    saved: 'Design saved. Emails use it from now on.',
    saveFailed: 'Could not save the design. Check the blocks marked in red.',
    cancel: 'Cancel',
    reset: 'Reset to default',
    resetTitle: 'Go back to the built-in email?',
    resetBody:
      'Your own blocks and wording for this email are removed. Customers get the built-in email again.',
    resetConfirm: 'Reset design',
    resetKeep: 'Keep my design',
    resetDone: 'Back to the built-in email.',
    subject: 'Subject line',
    subjectHint: 'Leave empty to keep the built-in subject.',
    blocks: 'Blocks',
    add: 'Add a block',
    noneSelected: 'Pick a block to change it.',
    remove: (name: string) => `Remove ${name}`,
    lockedNote:
      'Filled in from the real order. You can move it and change its words and colours, not remove it.',
    lockedLabel: 'Locked',
    builtInNote: 'Built-in words, filled in for each order. You can move or remove it.',
    unsaved: 'Unsaved changes',
    undo: 'Undo',
    redo: 'Redo',
    undoShortcut: 'Undo (Ctrl+Z)',
    redoShortcut: 'Redo (Ctrl+Shift+Z)',
    duplicate: (name: string) => `Duplicate ${name}`,
    addHint: 'Drag a block into the list, or click it to add it below the selected block.',
    full: 'This email has the most blocks it can hold. Remove one to add another.',
    dropEnd: 'Drop here to add at the end',
    settings: 'Block settings',
    settingsOf: (name: string) => `Settings: ${name}`,
  },
  preview: {
    title: 'Preview with a sample order',
    desktop: 'Desktop',
    mobile: 'Mobile',
    loading: 'Updating the preview…',
    failed: 'Could not draw the preview.',
    frameTitle: 'Email preview',
    subject: 'Subject',
  },
  variables: {
    title: 'Words that fill in',
    help: 'Type these in any text, button or the subject. Each one is replaced for every customer.',
    unknown: (names: string) => `Not available in this email: ${names}`,
    names: {
      customer_name: 'Customer name',
      store_name: 'Shop name',
      shop_url: 'Shop link',
      support_email: 'Support email',
      support_phone: 'Support phone',
      order_number: 'Order number',
      order_total: 'Order total',
      payment_method: 'Payment method',
      order_url: 'Order link',
      order_date: 'Order date',
      tracking_url: 'Tracking link',
      tracking_number: 'Tracking number',
      courier: 'Courier',
      delivered_on: 'Delivered on',
      return_number: 'Return number',
      coupon_value: 'Coupon value',
    } as Record<string, string>,
  },
  blocks: {
    logo: 'Logo and menu',
    heading: 'Heading',
    text: 'Text',
    image: 'Image',
    button: 'Button',
    divider: 'Divider',
    spacer: 'Spacer',
    social: 'Social links',
    help: 'Questions box',
    footer: 'Footer',
    hero: 'Hero image',
    products: 'Products',
    coupon: 'Discount code',
    video: 'Video',
    html: 'HTML',
    columns: 'Columns',
    intro: 'Title and opening line',
  } satisfies Record<DesignPaletteType | 'intro', string>,
  /** The template's own blocks, by kind. */
  slots: {
    ticket: 'Order route ticket',
    notice: 'Notice',
    status: 'Status box',
    facts: 'Order details',
    stats: 'Key numbers',
    columns: 'Address and payment',
    quote: 'Message',
    code: 'Code',
    coupon: 'Coupon',
    attachment: 'Attached file',
    product: 'Product',
    products: 'Products',
    parcels: 'Parcels',
    items: 'Items and totals',
    button: 'Main button',
    divider: 'Built-in divider',
    text: 'Built-in line',
    links: 'Extra links',
  } as Record<string, string>,
  fields: {
    menu: 'Show Shop, Track order and Contact links',
    eyebrow: 'Small line above the title',
    heading: 'Title',
    lead: 'Opening line',
    builtInPlaceholder: 'Built-in words',
    text: 'Text',
    textHint: 'Leave an empty line between paragraphs.',
    size: 'Size',
    large: 'Large',
    small: 'Small',
    medium: 'Medium',
    align: 'Alignment',
    left: 'Left',
    center: 'Centre',
    muted: 'Small grey text',
    image: 'Image',
    chooseImage: 'Choose image',
    changeImage: 'Change image',
    imageTitle: 'Choose an image',
    imageDescription: 'Pick a picture from your media library.',
    alt: 'Description for screen readers',
    width: 'Width',
    widthValue: (n: number) => `${n}%`,
    link: 'Link',
    linkHint: 'https://, mailto: or a word like {{order_url}}',
    pickPage: 'Link to a page',
    label: 'Button text',
    dividerLabel: 'Label (optional)',
    showSocial: 'Show social links',
    badLink: 'Use a link that starts with https://, http:// or mailto:',
    socialNote: 'Shows the social profiles from your theme settings.',
    helpNote: 'Shows "Questions? Reply to this email" and your WhatsApp number.',
    footerNote: 'Shows why the customer got this email and your shop address.',
  },
  sortable: {
    handle: (name: string) => `Move ${name}`,
    instructions:
      'Press space or enter to pick up a block, use the arrow keys to move it, then space or enter to drop it.',
    picked: (name: string) => `Picked up ${name}.`,
    moved: (name: string, position: number, total: number) =>
      `${name} moved to position ${position} of ${total}.`,
    dropped: (name: string, position: number, total: number) =>
      `${name} dropped at position ${position} of ${total}.`,
    cancelled: (name: string) => `Moving ${name} cancelled.`,
    newPicked: (name: string) => `Picked up a new ${name} block.`,
    newOver: (name: string, position: number, total: number) =>
      `New ${name} goes in at position ${position} of ${total}.`,
    newDropped: (name: string, position: number, total: number) =>
      `New ${name} added at position ${position} of ${total}.`,
    newCancelled: (name: string) => `Adding ${name} cancelled.`,
  },
}
