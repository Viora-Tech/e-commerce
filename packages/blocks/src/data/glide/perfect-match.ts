/** Copy and defaults for the Perfect match section (Port of sections/perfect-match.liquid). */

export const perfectMatchContent = {
  eyebrow: '',
  headingBefore: 'Find your perfect',
  highlight: 'match',
  headingAfter: '',
  highlightWords: 'mouse|glasspad|keyboard',
  poolCollection: '',
  cta: { label: 'Find my match', href: '/pages/find-your-match' },
  categories: [
    { label: 'Mouse', collectionHandle: 'mice' },
    { label: 'Mousepad', collectionHandle: 'mousepads' },
    { label: 'Glasspad', collectionHandle: 'glass-mousepads' },
    { label: 'Keyboard', collectionHandle: 'keyboard' },
  ],
  curated: [] as { handle: string }[],
  maxProducts: 6,
  /** Candidates read per category, from which one is picked. */
  candidatesPerCategory: 50,
  /** The same primes the theme salts each category's pick with. */
  salts: [11, 23, 37, 53, 67, 83, 97, 101],
  poolSalt: 71,
  rotateMs: 2200,
  rotateOutMs: 700,
} as const
