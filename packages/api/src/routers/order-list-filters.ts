/** The Orders list's filter input, shared by the list and "Select all". Split out of orders.ts. */
import { ORDER_FULFILLMENT_STATUSES, ORDER_PAYMENT_STATUSES } from '@commerce/core'
import { z } from 'zod'
import { SEARCH_MAX } from '../procedures'
import { ORDER_CHANNEL_FILTERS, ORDER_RETURN_FILTERS, ORDER_VIEWS } from '../services/order.service'

/** The Orders list's tab, search and filter panel, shared by the list and "Select all". */
export const listFilters = z.object({
  search: z.string().trim().max(SEARCH_MAX).optional(),
  /** The list tab. */
  view: z.enum(ORDER_VIEWS).optional(),
  paymentStatus: z.array(z.enum(ORDER_PAYMENT_STATUSES)).max(10).optional(),
  fulfillmentStatus: z.array(z.enum(ORDER_FULFILLMENT_STATUSES)).max(10).optional(),
  /** Placed at or after this moment (the filter panel's Date). */
  placedFrom: z.iso.datetime().optional(),
  placedTo: z.iso.datetime().optional(),
  /** Cash on delivery, or anything paid up front. */
  paymentMethod: z.enum(['cod', 'prepaid']).optional(),
  /** Sent with this courier (the filter panel's Courier). */
  courier: z.string().trim().min(1).max(60).optional(),
  /** Has a line whose product title, variant title or SKU contains this (the panel's Product). */
  product: z.string().trim().min(1).max(SEARCH_MAX).optional(),
  /** Carries any of these tags. */
  tags: z.array(z.string().trim().min(1).max(40)).max(50).optional(),
  /** Came from any of these marketing channels (`untracked`: no attribution recorded). */
  channels: z.array(z.enum(ORDER_CHANNEL_FILTERS)).max(ORDER_CHANNEL_FILTERS.length).optional(),
  /** Order total at least / at most, in paise. */
  totalMinPaise: z.number().int().min(0).optional(),
  totalMaxPaise: z.number().int().min(0).optional(),
  /** Used any of these discount codes (any case). */
  discountCodes: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
  /** Where the order's returns stand (`none`: never had one). */
  returnStatus: z.array(z.enum(ORDER_RETURN_FILTERS)).max(ORDER_RETURN_FILTERS.length).optional(),
  /** Has a line whose product is in any of these collections (#886). */
  collectionIds: z.array(z.uuid()).max(50).optional(),
})
