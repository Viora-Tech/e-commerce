/** Copy for the store picker (the login screen's is in `data/login.ts`). */
export const authContent = {
  selectStore: {
    title: 'Choose a store',
    open: (name: string) => `Open ${name}`,
    empty: {
      heading: 'No stores yet',
      body: 'Create your own, or ask an owner to invite you to theirs.',
    },
    createAnother: 'Create another store',
    switchFailed: 'Could not switch stores. Try again.',
    opening: 'Opening your store…',
  },
} as const
