import { cn } from '@commerce/ui/lib/utils'
import type { ComponentProps, ReactNode } from 'react'

export type PageWidth = 'full' | 'detail' | 'settings' | 'form' | 'narrow'

type PageBodyProps = Omit<ComponentProps<'div'>, 'children'> & {
  children: ReactNode
  /**
   * How wide the page runs. `full` (default): the panel's whole width, for lists.
   * `detail` 75rem: detail pages (order, product, customer). `settings` 68rem: Home, Settings,
   * Account. `form` 52rem: single-column forms (market, catalog, rollout). `narrow` 48rem:
   * small screens with one message or one choice (not found, pick a store).
   * Every width other than `full` is centred.
   */
  width?: PageWidth
}

const WIDTH_CLASS: Record<PageWidth, string> = {
  full: '',
  detail: 'mx-auto max-w-[75rem]',
  settings: 'mx-auto max-w-[68rem]',
  form: 'mx-auto max-w-[52rem]',
  narrow: 'mx-auto max-w-[48rem]',
}

/**
 * The one page shell: the page gutter (1rem, 1.5rem from `md`), 1.5rem between the header and
 * each block, and 1.5rem (2rem from `md`) under the last one. ProoflyListPage,
 * ProoflyDetailPage, ProoflyPageBody and the order page frame are thin wrappers on it, so a
 * list and the detail page opened from it line up.
 */
export default function PageBody({ children, width = 'full', className, ...rest }: PageBodyProps) {
  return (
    <div
      {...rest}
      className={cn(
        'flex w-full flex-col gap-6 px-4 pt-4 pb-6 md:px-6 md:pt-5 md:pb-8',
        WIDTH_CLASS[width],
        className,
      )}
    >
      {children}
    </div>
  )
}
