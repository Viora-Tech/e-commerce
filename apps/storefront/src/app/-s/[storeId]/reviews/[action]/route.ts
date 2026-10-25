import { withEvlog } from '@/lib/request-log'
import { markReviewHelpful, submitReviewForm, uploadReviewPhoto } from '@/lib/review-actions'

type Params = { params: Promise<{ storeId: string; action: string }> }

/**
 * The Reviews app's storefront endpoints, called by the product page widget:
 * `/reviews/photo` (one photo), `/reviews/submit` (the review) and `/reviews/helpful`.
 * The store is the one the hostname resolved to (see `lib/review-actions.ts`), never the
 * path segment or the body. Answers are JSON.
 */
export const POST = withEvlog(async (req: Request, { params }: Params) => {
  const { action } = await params
  if (action === 'photo' || action === 'submit') {
    const form = await req.formData().catch(() => null)
    if (!form) return Response.json({ ok: false, error: 'generic' }, { status: 400 })
    const result = action === 'photo' ? await uploadReviewPhoto(form) : await submitReviewForm(form)
    return Response.json(result, { status: result.ok ? 200 : 422 })
  }
  if (action === 'helpful') {
    const body = (await req.json().catch(() => null)) as { id?: unknown } | null
    const result = await markReviewHelpful(body?.id)
    return Response.json(result, { status: result.ok ? 200 : 422 })
  }
  return new Response('Not found', { status: 404 })
})
