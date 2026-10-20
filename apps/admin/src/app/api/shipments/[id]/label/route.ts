import { ORPCError } from '@orpc/server'
import { appRouter, call, serverContext } from '@/lib/api'
import { withEvlog } from '@/lib/request-log'

type Params = { params: Promise<{ id: string }> }

/**
 * A courier label kept in the store's private storage (Blue Dart and DTDC hand back the PDF
 * itself, not a public link). Opened from the shipment's "Print label" link; the router checks
 * the session, the member's permission and the store, so this only turns its file into a PDF
 * response the browser shows inline.
 */
export const GET = withEvlog(async (_request: Request, { params }: Params) => {
  const { id } = await params
  try {
    const context = await serverContext()
    const file = await call(appRouter.shipments.label, { id }, { context })
    return new Response(file, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${file.name}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    if (error instanceof ORPCError && error.code === 'UNAUTHORIZED') {
      return new Response('Unauthorized', { status: 401 })
    }
    if (error instanceof ORPCError && error.code === 'FORBIDDEN') {
      return new Response('Forbidden', { status: 403 })
    }
    return new Response('Not found', { status: 404 })
  }
})
