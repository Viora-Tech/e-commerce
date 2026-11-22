/** The bar pinned over the store while a staff member is signed in as a customer (admin › Customer › Sign in as customer). */
export const staffSignInBarContent = {
  label: (name: string) => `Signed in as ${name} by staff`,
  unnamed: 'this customer',
  signOut: 'Sign out',
} as const
