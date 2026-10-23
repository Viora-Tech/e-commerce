import { ORPCError } from '@orpc/server'
import { importedSource } from '../services/order.service'

/** Imported historical orders are read-only; every state-changing route refuses them. */
export async function assertNotImported(
  tx: Parameters<typeof importedSource>[0],
  ref: Parameters<typeof importedSource>[1],
) {
  const source = await importedSource(tx, ref)
  if (source) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'This order was imported and is read-only. Notes and tags can still be changed.',
    })
  }
}
