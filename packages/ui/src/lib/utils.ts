import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * Font-size tokens declared in styles.css (`--text-*`). tailwind-merge only knows
 * Tailwind's default scale, so without this list `cn('text-body', 'text-success')`
 * treats both as colours and drops the size. Keep in sync with the `@theme` block.
 */
const FONT_SIZE_TOKENS = [
  'body',
  'body-strong',
  'caption',
  'card-title',
  'kit-body',
  'kit-cell',
  'kit-heading',
  'kit-label',
  'kit-stat',
  'kit-stat-sm',
  'kit-table-title',
  'kit-title',
  'nav',
  'page-title',
  'period',
  'stat',
  'stat-sm',
  'table-head',
]

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: FONT_SIZE_TOKENS }],
    },
  },
})

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
