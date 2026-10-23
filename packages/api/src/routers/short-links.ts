import { permissions } from '@commerce/core'
import { z } from 'zod'
import { can, PAGE_SIZE_MAX, SEARCH_MAX } from '../procedures'
import {
  createShortLink,
  deleteShortLink,
  listShortLinks,
  shortLinkTotals,
  shortLinkTrend,
  updateShortLink,
} from '../services/short-links.service'

const tag = z.string().trim().max(120).optional()

const linkInput = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(60),
  destination: z.string().trim().min(1).max(2000),
  utmSource: tag,
  utmMedium: tag,
  utmCampaign: tag,
  utmContent: tag,
  utmTerm: tag,
})

/** Growth → Links: short `/l/<slug>` links with their clicks, orders and revenue. */
export const shortLinksRouter = {
  list: can(permissions.MARKETING_READ)
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(PAGE_SIZE_MAX).default(25),
        search: z.string().trim().max(SEARCH_MAX).optional(),
      }),
    )
    .handler(({ context, input }) => listShortLinks(context.tx, input)),

  /** Links, clicks, orders and revenue across every link, for the summary line. */
  totals: can(permissions.MARKETING_READ).handler(({ context }) => shortLinkTotals(context.tx)),

  /** Clicks, orders and revenue per day over the last 30 days, for the Links chart. */
  trend: can(permissions.MARKETING_READ).handler(({ context }) => shortLinkTrend(context.tx)),

  create: can(permissions.MARKETING_WRITE)
    .input(linkInput)
    .handler(({ context, input }) =>
      createShortLink(context.tx, context.scope.storeId, input, context.session?.user?.id ?? null),
    ),

  update: can(permissions.MARKETING_WRITE)
    .input(linkInput.extend({ id: z.uuid() }))
    .handler(({ context, input }) => {
      const { id, ...rest } = input
      return updateShortLink(context.tx, id, rest)
    }),

  delete: can(permissions.MARKETING_WRITE)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => deleteShortLink(context.tx, input.id)),
}
