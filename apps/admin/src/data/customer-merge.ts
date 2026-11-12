/** Copy for merging two customers, moving an order to another customer, and changing an email. */

/** The customer search both dialogs share. */
export const customerPickerContent = {
  label: 'Find a customer',
  placeholder: 'Name, email or mobile number',
  searching: 'Searching…',
  none: 'No customer matches that.',
  hint: 'Type at least 2 letters.',
  unnamed: 'No name',
  orders: (n: number) => (n === 1 ? '1 order' : `${n} orders`),
} as const

/** Customer page › More actions › "Merge with another customer…". */
export const customerMergeContent = {
  menu: 'Merge with another customer…',
  title: 'Merge with another customer',
  pickBody:
    'Pick the other record of the same person. Everything it holds moves onto this customer, and the other record is closed.',
  reviewBody: (other: string) =>
    `Everything ${other} holds moves onto this customer in one go. The other record is then closed and its sign-ins end.`,
  moves: 'What moves here',
  orders: (n: number) => (n === 1 ? '1 order' : `${n} orders`),
  addresses: (n: number) => (n === 1 ? '1 saved address' : `${n} saved addresses`),
  storeCredit: (amount: string) => `${amount} store credit (added to this balance)`,
  giftCards: (n: number) => (n === 1 ? '1 gift card' : `${n} gift cards`),
  signIns: (n: number) =>
    n === 1 ? '1 sign-in (Google, Apple…)' : `${n} sign-ins (Google, Apple…)`,
  carts: (n: number) => (n === 1 ? '1 cart' : `${n} carts`),
  notes: (n: number) => (n === 1 ? '1 timeline note' : `${n} timeline notes`),
  reviews: (n: number) => (n === 1 ? '1 review or question' : `${n} reviews and questions`),
  conversations: (n: number) => (n === 1 ? '1 inbox conversation' : `${n} inbox conversations`),
  alsoMoves: 'Tags, notes, marketing consent history and browsing history come along too.',
  nothing: 'Nothing else is linked to the other record.',
  keepHeading: 'Keep these details',
  email: 'Email',
  phone: 'Phone',
  name: 'Name',
  thisOne: 'This customer',
  otherOne: 'The other record',
  none: 'None',
  emailHint:
    'The shopper signs in with the email you keep. Their Google or Apple sign-in moves over either way.',
  cancel: 'Cancel',
  confirm: 'Merge customers',
  done: 'Customers merged',
  failed: 'Could not merge the customers',
} as const

/** Order page › Customer card: "Change customer", and the contact edit's email offer. */
export const orderCustomerContent = {
  change: 'Change customer',
  changeHint: 'Move this order to another existing customer',
  title: 'Change customer',
  body: 'The order moves to the customer you pick and shows in their account. It keeps its own email, phone and address.',
  current: (name: string) => `Now: ${name}`,
  guest: 'Now: a guest checkout',
  confirm: 'Move order',
  cancel: 'Cancel',
  done: 'Order moved',
  failed: 'Could not move the order',
  emailOwner: (name: string) => `This email belongs to ${name}. Also move this order to them?`,
  emailOwnerHint: 'The order then shows in their account. The two customers are not merged.',
  importedTax: 'An imported order keeps the GSTIN and company name it came with.',
} as const

/** The customer page's Edit dialog: changing the customer's email. */
export const customerEmailContent = {
  help: 'The shopper signs in with this email. Their orders keep the email they were placed with.',
  taken:
    'Another customer already has this email. To make them one customer, use More actions › Merge with another customer.',
  openOther: 'Open that customer',
  discardBody: 'The name, email and phone you changed are not saved yet.',
} as const
