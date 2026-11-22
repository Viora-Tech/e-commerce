'use client'

import { CircleCheck, Eye, EyeOff, StarIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import type { AppPageProps } from '@/apps/registry'
import EmptyState from '@/components/layout/empty-state'
import PageColumns from '@/components/layout/page-columns'
import PageHeader from '@/components/layout/page-header'
import SectionPageSkeleton from '@/components/layout/section-page-skeleton'
import StatusLabel from '@/components/status/status-label'
import { reviewsContent } from '@/data/reviews'
import { useCopy } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import { routes } from '@/lib/routes'
import ActivityCard from './activity-card'
import ReplyCard from './reply-card'
import ReviewCard from './review-card'
import ReviewSideCards from './review-side-cards'

type Detail = Awaited<ReturnType<typeof api.reviews.get>>

/** One review (Apps, Reviews 20:2): the review, the reply, its activity, product and customer. */
export default function ReviewDetail({ params }: AppPageProps) {
  // Hooks
  const reviewsCopy = useCopy(reviewsContent)
  const { detail: copy } = useCopy(reviewsContent)
  const router = useRouter()
  const [version, setVersion] = useState(0)
  // A failed read reads as a review that is gone.
  const { data: detail, failed: missing } = useLoad<Detail>(
    () => api.reviews.get({ id: params.id ?? '' }),
    [params.id, version],
  )
  const [busy, setBusy] = useState(false)
  /** The status being set, so only that button spins while `busy`. */
  const [pending, setPending] = useState<'published' | 'hidden' | null>(null)

  // Helpers
  const reload = () => setVersion((v) => v + 1)

  // Event handlers
  const handleStatus = async (status: 'published' | 'hidden') => {
    setPending(status)
    setBusy(true)
    try {
      await api.reviews.setStatus({ ids: [params.id ?? ''], status })
      toast.success(copy.saved)
      reload()
    } catch (err) {
      toast.error(errorText(err, reviewsCopy.list.failed))
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
  if (!detail) return <SectionPageSkeleton header={false} />

  // Render logic
  const r = detail.review

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={copy.title(r.reviewerName)}
        back={{ label: copy.back, href: routes.apps.page('reviews') }}
        badges={<StatusLabel kind="review" value={r.status} variant="soft" />}
        actions={
          <>
            {r.status !== 'hidden' ? (
              <Button
                variant="outline"
                disabled={busy}
                loading={busy && pending === 'hidden'}
                onClick={() => handleStatus('hidden')}
              >
                <EyeOff aria-hidden="true" />
                {copy.hide}
              </Button>
            ) : null}
            {r.status !== 'published' ? (
              <Button
                disabled={busy}
                loading={busy && pending === 'published'}
                onClick={() => handleStatus('published')}
              >
                {r.status === 'hidden' ? (
                  <Eye aria-hidden="true" />
                ) : (
                  <CircleCheck aria-hidden="true" />
                )}
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
