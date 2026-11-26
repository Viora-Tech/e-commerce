import 'server-only'
import { headers } from 'next/headers'
import { cache } from 'react'
import { PRIORITY, RequestSlot, renderGate } from './render-gate'
import { RENDER_TICKET_HEADER } from './routing'

/** This request's share of the render queue, under the ticket the proxy issued it. */
const requestSlot = cache(async (): Promise<RequestSlot> => {
  const { gate, tickets } = renderGate()
  const id = (await headers()).get(RENDER_TICKET_HEADER)
  const ticket = id ? tickets.get(id) : undefined
  return new RequestSlot(gate, ticket?.priority ?? PRIORITY.visitor, ticket?.signal)
})

/**
 * Runs a cache-miss render once this request has a slot in the render queue (`render-gate.ts`).
 * `work` gets the visitor's abort signal, to stop between sections once they have gone; the call
 * throws `RenderAbortedError` when they leave while it waits.
 */
export async function withRenderSlot<T>(
  work: (signal: AbortSignal | undefined) => Promise<T>,
): Promise<T> {
  return (await requestSlot()).run(work)
}
