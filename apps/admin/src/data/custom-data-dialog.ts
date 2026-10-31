/** Copy for the Add / Edit extra field dialog of Settings › Custom data; part of customDataContent. */

export const customDataDialogContent = {
  addTitle: (owner: string) => `Add ${owner.toLowerCase()} extra field`,
  editTitle: 'Edit extra field',
  name: 'Name',
  namePlaceholder: 'Care guide',
  namespaceKeyHelp: 'Your theme reads it as metafields.namespace.key. It is fixed once you save.',
  namespaceKey: 'Theme key',
  description: 'Hint',
  descriptionPlaceholder: 'Shown under the field',
  storefront: 'Show on your store',
  storefrontHelp: 'Let your theme show this value.',
  filterable: 'Use as filter',
  filterableHelp:
    'Shoppers can narrow collection and search pages by this value, like Grip or Hand size.',
  privateNote: 'Customer and order extra fields stay private: they are never shown on your store.',
  fixed: 'What goes in it and the key are fixed once the extra field is saved.',
  save: 'Save',
  saving: 'Saving',
  cancel: 'Cancel',
  saved: 'Extra field saved',
  failed: 'Could not save. Check your connection and try again.',
}
