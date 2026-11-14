import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import PageHeader from '@/components/layout/page-header'

type PageHeaderSkeletonProps = {
  /** The page's title when the loader knows it ("Orders"): the real PageHeader draws it. */
  title?: string | undefined
  /** How many header buttons stand on the right (each a 2.25rem bar). */
  actions?: number
}

/* Bar widths for the header buttons, the key primary last. */
const ACTION_WIDTHS = ['w-28', 'w-32', 'w-24'] as const

/* The summary line under the title: one body line (1.25rem) holding a bar. */
const SUMMARY = (
  <span className="flex h-5 items-center">
    <Skeleton className="h-3.5 w-64 max-w-full" />
  </span>
)

/**
 * The page header while a page loads, as tall as the loaded one: the title line (2.25rem,
 * `text-page-title`), the summary line (1.25rem) 0.25rem under it, and 2.25rem buttons on the
 * right. With a title it is the real PageHeader with bars in the summary and actions; without
 * one it copies PageHeader's boxes with a bar for the title.
 */
export default function PageHeaderSkeleton({ title, actions = 1 }: PageHeaderSkeletonProps) {
  // Render logic
  const buttons =
    actions > 0 ? (
      <div className="flex items-center gap-2">
        {Array.from({ length: actions }, (_, i) => (
          <Skeleton
            key={`action-${i.toString()}`}
            className={`h-9 rounded-sm ${ACTION_WIDTHS[(actions - 1 - i) % ACTION_WIDTHS.length]}`}
          />
        ))}
      </div>
    ) : undefined

  return title ? (
    <PageHeader title={title} summary={SUMMARY} actions={buttons} />
  ) : (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-[min(100%,16rem)] flex-1 flex-col gap-1">
          <span className="flex h-9 items-center">
            <Skeleton className="h-7 w-40" />
          </span>
          {SUMMARY}
        </div>
        {buttons}
      </div>
    </div>
  )
}
