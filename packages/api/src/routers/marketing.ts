import { permissions } from '@commerce/core'
import { z } from 'zod'
import { can } from '../procedures'
import { marketingOverview } from '../services/marketing-overview.service'

const rangeInput = z.object({
  key: z.enum(['today', '7d', '30d', '90d', 'custom']).default('30d'),
  /** ISO dates, read only when `key` is `custom`. */
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
})

export const marketingRouter = {
  /** Sessions, attributed sales, channels and top campaigns for one range. */
  overview: can(permissions.MARKETING_READ)
    .input(z.object({ range: rangeInput.default({ key: '30d' }) }))
    .handler(({ context, input }) => marketingOverview(context.tx, { range: input.range })),
}
