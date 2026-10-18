/** Copy for the wishlist page (Figma Pages · Wishlist). */
export const wishlistContent = {
  title: 'Wishlist',
  count: (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`,
  loading: 'Loading your wishlist…',
  noteTitle: 'Saved on this device',
  noteBody: 'Sign in to keep your wishlist on every device.',
  emptyTitle: 'Your wishlist is empty',
  emptyBody: 'Tap the heart on any product to save it here.',
  emptyAction: 'Browse products',
} as const
