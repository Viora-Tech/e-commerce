/** The shared "Browse" picker dialog (products, collections, customers, segments). */
export const resourcePickerContent = {
  loading: 'Loading',
  failed: 'Could not load the list',
  retry: 'Try again',
  selectPage: 'Select all shown',
  selectedCount: (n: number) => `${n} selected`,
  clear: 'Clear',
  cancel: 'Cancel',
  done: 'Done',
  oneKind: 'Picking here replaces what you picked on the other tab.',
} as const
