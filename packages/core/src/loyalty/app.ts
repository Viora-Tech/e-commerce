/** SOURCE OF TRUTH: the Loyalty points app manifest — WHAT: the built-in, free "Loyalty points" app (listing, access, hooks on delivery, refund, cancel and RTO, admin pages and the customer card) / WHY: the App Store catalogue, Installed apps, the admin sidebar and the worker's app events read apps from manifests; the engine is core (`packages/core/src/loyalty/`) because points are store credit, written under the account lock. Free on every plan because it is absent from `APP_PRICING`. Imported by commerce.config.ts. */
import { definePlugin } from '@commerce/plugins'
import { planOrderPoints, reverseOrderPoints } from './earn'
import { grantNewsletterPoints, grantSignupPoints, planFirstOrderBonus } from './grants'
import { markRedemptionsUsed } from './redeem'
import { referralOrderDelivered } from './referrals'
import { LOYALTY_APP_ID } from './settings'
import { loyaltyState } from './state'
import { loyaltyBlocks, loyaltyEmbeds } from './storefront-blocks'

/**
 * Loyalty points: shoppers earn points (₹1 each, as store credit) on delivered orders once the
 * return window is over, for reviews and on their birthday, and spend them at checkout like any
 * store credit. Refunds, cancels and RTO take points back; points run out after a year. Own
 * code: points ride on the store credit balance, which no outside tool knows about.
 */
export const loyaltyPlugin = definePlugin({
  id: LOYALTY_APP_ID,
  name: 'Loyalty points',
  version: '2.0.0',
  kind: 'builtin',
  category: 'marketing',
  description:
    'Reward repeat shoppers: points on every delivered order, for reviews and on birthdays, spent at checkout as store credit.',
  listing: {
    tagline: 'Points on every order, spent at checkout like store credit.',
    highlights: [
      '1 point per ₹100 spent by default, credited after the return window',
      'Points are store credit: 1 point is ₹1 off a later order',
      'Extra points for a review and on the shopper’s birthday',
      'Refunds, cancels and RTO take the points back',
      'Points run out after 12 months, with a reminder email first',
    ],
    worksWith: ['Store credit at checkout', 'The Reviews app', 'Returns (the return window)'],
    keywords: ['loyalty', 'points', 'rewards', 'cashback', 'store credit', 'birthday'],
    faq: [
      {
        question: 'When do shoppers get their points?',
        answer:
          'Once the order is delivered and your return window is over, so points never land for goods that come back.',
      },
      {
        question: 'How do shoppers spend points?',
        answer:
          'Points sit in their store credit balance. At checkout the store credit box takes them off the order.',
      },
    ],
  },
  access: {
    resources: [
      {
        resource: 'orders',
        level: 'read-write',
        why: 'Works out the points a delivered order earns; tags a referred friend’s first order',
      },
      { resource: 'refunds', level: 'read', why: 'Takes points back when an order is refunded' },
      {
        resource: 'customers',
        level: 'read-write',
        why: 'Adds and takes points on the store credit balance; saves birthdays',
      },
      {
        resource: 'reviews',
        level: 'read',
        why: 'Gives points for a review of a delivered product',
      },
      {
        resource: 'order-events',
        level: 'read',
        why: 'Reacts when an order is paid, delivered, refunded, cancelled or returned',
      },
      {
        resource: 'discounts',
        level: 'read-write',
        why: 'Makes one-use reward and referral codes, and sees when an order used one',
      },
    ],
    summary: 'gives loyalty points',
  },
  provides: {},
  storefront: { blocks: loyaltyBlocks, embeds: loyaltyEmbeds },
  hooks: {
    'order.paid': async (ctx, payload) => {
      await ctx.inStore((tx) => markRedemptionsUsed({ storeId: ctx.storeId, tx }, payload.orderId))
    },
    'order.delivered': async (ctx, payload) => {
      const row = await ctx.inStore(async (tx) => {
        const sctx = { storeId: ctx.storeId, tx }
        const { settings } = await loyaltyState(tx, ctx.storeId)
        await markRedemptionsUsed(sctx, payload.orderId)
        await planFirstOrderBonus(sctx, payload.orderId, settings)
        await referralOrderDelivered(sctx, payload.orderId, settings)
        return planOrderPoints(sctx, payload.orderId, settings)
      })
      if (row) ctx.reportActivity?.(`${row.points} points on the way for a delivered order`)
    },
    'customer.created': async (ctx, payload) => {
      if (!payload.customerId) return
      const customerId = payload.customerId
      await ctx.inStore(async (tx) => {
        const sctx = { storeId: ctx.storeId, tx }
        const { settings } = await loyaltyState(tx, ctx.storeId)
        await grantSignupPoints(sctx, customerId, settings)
        await grantNewsletterPoints(sctx, customerId, settings)
      })
    },
    'customer.updated': async (ctx, payload) => {
      if (!payload.customerId) return
      const customerId = payload.customerId
      await ctx.inStore(async (tx) => {
        const { settings } = await loyaltyState(tx, ctx.storeId)
        await grantNewsletterPoints({ storeId: ctx.storeId, tx }, customerId, settings)
      })
    },
    'refund.created': async (ctx, payload) => {
      await ctx.inStore(async (tx) => {
        const { settings } = await loyaltyState(tx, ctx.storeId)
        await reverseOrderPoints({ storeId: ctx.storeId, tx }, payload.orderId, settings)
      })
    },
    'order.cancelled': async (ctx, payload) => {
      await ctx.inStore(async (tx) => {
        const { settings } = await loyaltyState(tx, ctx.storeId)
        await reverseOrderPoints({ storeId: ctx.storeId, tx }, payload.orderId, settings)
      })
    },
    'order.rto': async (ctx, payload) => {
      await ctx.inStore(async (tx) => {
        const { settings } = await loyaltyState(tx, ctx.storeId)
        await reverseOrderPoints(
          { storeId: ctx.storeId, tx },
          payload.orderId,
          settings,
          new Date(),
          {
            voided: true,
          },
        )
      })
    },
  },
  admin: {
    icon: 'Gift',
    customerDetailCard: true,
    pages: [
      // Menu order as Essential Loyalty: Home, Program, Campaigns, Members, Analytics,
      // Placements; Emails after. Activity opens from a Members header button.
      { path: 'overview', title: 'Home', navLabel: 'Home', icon: 'BarChart3' },
      { path: '', title: 'Loyalty points', navLabel: 'Program', icon: 'Gift' },
      { path: 'campaigns', title: 'Campaigns', navLabel: 'Campaigns', icon: 'StarIcon' },
      { path: 'members', title: 'Members', navLabel: 'Members', icon: 'Users' },
      { path: 'analytics', title: 'Analytics', navLabel: 'Analytics', icon: 'FileBarChart' },
      { path: 'placements', title: 'Placements', navLabel: 'Placements', icon: 'Blocks' },
      { path: 'emails', title: 'Emails', navLabel: 'Emails', icon: 'MessageSquare' },
      { path: 'rewards/[id]', title: 'Reward' },
      { path: 'activity', title: 'Activity' },
      { path: 'campaigns/[id]', title: 'Campaign' },
    ],
  },
})
