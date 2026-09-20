export type GlobalPaginationProps = {
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
  onPageChange: (page: number) => void
  onPrevious: () => void
  onNext: () => void
  className?: string
  pageSizeOptions?: number[]
  onPageSizeChange?: (size: number) => void
  variant?: 'default' | 'topic'
}
