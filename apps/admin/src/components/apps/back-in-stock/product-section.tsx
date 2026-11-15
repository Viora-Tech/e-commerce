'use client'

import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import type { ProductSectionProps } from '@/apps/product-sections'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import EmptyState from '@/components/layout/empty-state'
import { appsContent } from '@/data/apps'
import { productPageContent } from '@/data/product-page'
import { useCopy } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type Signup = Awaited<ReturnType<typeof api.backInStock.signups.list>>[number]

/** The Back in stock app on a product's More tab: who is waiting for which of its variants. */
export default function ProductSection({ variants }: ProductSectionProps) {
  // Hooks
  const apps = useCopy(appsContent)
  const copy = useCopy(productPageContent)
  /** Skeleton lines while it loads; "Could not load the signups" with Try again when it fails. */
  const { data: signups, failed, retry } = useLoad<Signup[]>(() => api.backInStock.signups.list({}))

  // Early returns
  if (failed) {
    return <LoadFailedState heading={apps.couldNotLoad.signups} failed={failed} onRetry={retry} />
  }
  if (!signups) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-2/3" />
      </div>
    )
  }

  // Render logic
  const c = copy.backInStock
  const ids = new Set(variants.map((v) => v.id))
  const mine = signups.filter((s) => ids.has(s.variantId))
  const waiting = mine.filter((s) => s.status === 'confirmed')
  const pending = mine.filter((s) => s.status === 'pending_confirmation').length
  const perVariant = variants
    .map((v) => ({ ...v, n: waiting.filter((s) => s.variantId === v.id).length }))
    .filter((v) => v.n > 0)

  return (
    <div className="flex flex-col gap-3">
      {waiting.length === 0 && pending === 0 ? (
        <EmptyState variant="inline" body={c.empty} />
      ) : (
        <>
          <p className="text-body-strong">
            {c.waiting(waiting.length)}
            {pending > 0 ? (
              <span className="font-normal text-muted-foreground"> · {c.pending(pending)}</span>
            ) : null}
          </p>
          {variants.length > 1 && perVariant.length > 0 ? (
            <ul className="flex flex-col divide-y divide-border">
              {perVariant.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 py-2 text-body">
                  <span className="min-w-0 truncate">{v.label}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {c.variantWaiting(v.n)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
      <Link
        href={routes.apps.page('back-in-stock', 'signups')}
        className="self-start text-body font-medium text-link hover:underline"
      >
        {c.viewAll}
      </Link>
    </div>
  )
}
