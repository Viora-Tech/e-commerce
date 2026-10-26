import { ORPCError } from '@orpc/server'
import { appRouter, call, serverContext } from '@/lib/api'
import { withEvlog } from '@/lib/request-log'

type Params = { params: Promise<{ id: string }> }

/**
 * Every shipment's "Print label" lands here. The label is the copy kept in the store's private
 * storage (Blue Dart, DTDC, DHL Express, FedEx hand back the PDF itself), or the courier's own
 * fetched server-side with the store's saved key (Delhivery's packing slip answers 401 without
 * it), so the key never reaches the browser. The router checks the session, the member's
 * permission and the store; this only turns its file into a PDF the browser shows inline.
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
    // The courier could not hand the label over: say why (our wording, never the courier's raw).
    if (error instanceof ORPCError && error.code === 'BAD_REQUEST') {
      return new Response(error.message, {
        status: 502,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      })
    }
    return new Response('Not found', { status: 404 })
  }
})
