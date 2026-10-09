'use client'

import { StarIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { AppPageProps } from '@/apps/registry'
import EmptyState from '@/components/layout/empty-state'
import PageColumns from '@/components/layout/page-columns'
import PageHeader from '@/components/layout/page-header'
import StatusLabel from '@/components/status/status-label'
import { reviewsContent } from '@/data/reviews'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import ActivityCard from './activity-card'
import ReplyCard from './reply-card'
import ReviewCard from './review-card'
import ReviewSideCards from './review-side-cards'

type Detail = Awaited<ReturnType<typeof api.reviews.get>>

/** One review (Apps, Reviews 20:2): the review, the reply, its activity, product and customer. */
export default function ReviewDetail({ params }: AppPageProps) {
  // Hooks
  const { detail: copy } = useCopy(reviewsContent)
  const router = useRouter()
  const [detail, setDetail] = useState<Detail | null>(null)
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [version, setVersion] = useState(0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-runs the load after a change
  useEffect(() => {
    let cancelled = false
    api.reviews
      .get({ id: params.id ?? '' })
      .then((d) => !cancelled && setDetail(d))
      .catch(() => !cancelled && setMissing(true))
    return () => {
      cancelled = true
    }
  }, [params.id, version])

  // Helpers
  const reload = () => setVersion((v) => v + 1)

  // Event handlers
  const handleStatus = async (status: 'published' | 'hidden') => {
    setBusy(true)
    try {
      await api.reviews.setStatus({ ids: [params.id ?? ''], status })
      toast.success(copy.saved)
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : reviewsContent.list.failed)
    } finally {
      setBusy(false)
    }
  }
  const handleDeleted = () => {
    toast.success(copy.deleted)
    router.push(routes.apps.page('reviews'))
  }

  // Early returns
  if (missing) {
    return (
      <Card inset="y-10">
        <EmptyState
          heading={copy.notFound}
          icon={StarIcon}
          action={
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={routes.apps.page('reviews')} />}
            >
              {copy.back}
            </Button>
          }
        />
      </Card>
    )
  }
  if (!detail) return <Skeleton className="h-96 w-full rounded-lg" />

  // Render logic
  const r = detail.review

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={copy.title(r.reviewerName)}
        breadcrumbs={[
          { label: copy.back, href: routes.apps.page('reviews') },
          { label: r.reviewerName },
        ]}
        badges={<StatusLabel kind="review" value={r.status} variant="pill" />}
        actions={
          <>
            {r.status !== 'hidden' ? (
              <Button variant="outline" disabled={busy} onClick={() => handleStatus('hidden')}>
                {copy.hide}
              </Button>
            ) : null}
            {r.status !== 'published' ? (
              <Button disabled={busy} onClick={() => handleStatus('published')}>
                {busy ? <Spinner /> : null}
                {r.status === 'hidden' ? copy.unhide : copy.approve}
              </Button>
            ) : null}
          </>
        }
      />
      <PageColumns
        main={
          <>
            <ReviewCard detail={detail} />
            <ReplyCard key={r.reply ?? ''} reviewId={r.id} reply={r.reply} onSaved={reload} />
            <ActivityCard activity={detail.activity} />
          </>
        }
        side={<ReviewSideCards detail={detail} onChanged={reload} onDeleted={handleDeleted} />}
      />
    </div>
  )
}
