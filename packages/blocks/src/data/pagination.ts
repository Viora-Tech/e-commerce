/** Labels for the numbered pagination (Figma Store / Pagination). */
export const paginationContent = {
  label: (page: number, pages: number) => `Page ${page} of ${pages}`,
  previous: 'Previous page',
  next: 'Next page',
} as const
