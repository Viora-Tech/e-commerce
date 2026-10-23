import { settingsSecret } from '@commerce/config'
import { isDeletionCode } from '@commerce/core'
import { type NextRequest, NextResponse } from 'next/server'

/**
 * The status page Meta links a person to after they asked for their data to be deleted
 * (the worker's `/webhooks/platform/meta/data-deletion` answers with this URL). Deletion
 * happens straight away, so any code we signed reads as done.
 */
export function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code') ?? ''
  const known = code.length < 100 && isDeletionCode(code, settingsSecret())
  const body = known
    ? `Deletion request ${code}: completed. The Facebook access and catalog records this platform held for you have been removed.`
    : 'We do not recognise this deletion request code.'
  return new NextResponse(body, {
    status: known ? 200 : 404,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  })
}
