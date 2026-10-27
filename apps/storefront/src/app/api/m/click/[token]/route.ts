import { settingsSecret } from '@commerce/config'
import { recordMessageClick, verifyClickToken } from '@commerce/core'
import { logger } from '@commerce/observability/logging'
import { headers } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import {
  encodeMarketingClick,
  MARKETING_CLICK_COOKIE,
  MARKETING_CLICK_MAX_AGE,
} from '@/lib/attribution-cookie'
import { redirectTo } from '@/lib/redirect'
import { withEvlog } from '@/lib/request-log'
import { inStore } from '@/lib/store-context'

type Params = { params: Promise<{ token: string }> }

/**
 * Tracked link in a marketing email. The token signs the destination, so
 * this cannot be used as an open redirect: an unsigned or altered URL goes to
 * the store's home page. A valid click is recorded and leaves a short-lived
 * cookie so the landing page's beacon credits the session (and any order) to
 * the campaign or automation.
 */
export const GET = withEvlog(async (request: NextRequest, { params }: Params) => {
  const { token } = await params
  const storeId = (await headers()).get('x-store-id')
  const target = request.nextUrl.searchParams.get('u') ?? ''
  const payload = verifyClickToken(token, target, settingsSecret())
  if (!payload || !storeId || payload.storeId !== storeId || !/^https?:\/\//i.test(target)) {
    return redirectTo('/')
  }
  let owner: { campaignId: string | null; automationId: string | null } | null = null
  try {
    owner = await inStore(storeId, (tx) => recordMessageClick(tx, payload.messageId))
  } catch (err) {
    logger.warn('could not record a message click', { storeId, error: err })
  }
  const response = NextResponse.redirect(target)
  response.cookies.set(
    MARKETING_CLICK_COOKIE,
    encodeMarketingClick({
      messageId: payload.messageId,
      campaignId: owner?.campaignId ?? undefined,
      automationId: owner?.automationId ?? undefined,
    }),
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      path: '/',
      maxAge: MARKETING_CLICK_MAX_AGE,
    },
  )
  return response
})
