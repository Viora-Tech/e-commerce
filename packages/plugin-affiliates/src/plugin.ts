import { definePlugin } from '@commerce/plugins'
import { affiliateBlocks } from './blocks'
import {
  applyRefunds,
  approveDueCommissions,
  creditOrder,
  reverseCommission,
  startHold,
} from './commissions'
import { orderLinks } from './enrol'
import { AFFILIATES_ID } from './settings'
import { loadAffiliateSettings } from './store-settings'

/**
 * Affiliates: a referral program run inside the store. Each approved affiliate gets a `?ref=`
 * link and a personal discount code; an order through either earns a commission that waits
 * for delivery and the return window, is reversed by a cancel, RTO or refund, and is paid by
 * the merchant outside the platform (UPI or a bank bulk-upload file), with TDS worked out.
 * Own code: the open-source referral tools are AGPL or source-available (see
 * docs/research/2026-10-23-affiliate-apps.md).
 */
export const affiliatesPlugin = definePlugin({
  id: AFFILIATES_ID,
  name: 'Affiliates',
  version: '1.1.0',
  kind: 'builtin',
  category: 'marketing',
  description:
    'Run your own affiliate and influencer program: referral links and codes, commissions after delivery, payouts with TDS.',
  listing: {
    tagline:
      'Referral links and codes for creators, paid only on orders that are delivered and kept.',
    highlights: [
      'A link and a discount code per affiliate',
      'Several programs, each with its own rates, order-value levels and signup page',
      'Commission waits for delivery and the return window; cancels, RTO and refunds reverse it',
      'Payouts by UPI or a bank bulk-upload file, with TDS worked out',
      'A signup page and dashboard for affiliates on your store',
      'Share and earn: turn happy buyers into affiliates with one tap',
      'Creatives, a link builder with QR codes, and trends for every affiliate',
    ],
    guide: '/merchant-guide/apps/affiliates',
    worksWith: [
      'Discounts (each affiliate’s code is a normal discount)',
      'Instagram, YouTube and WhatsApp creators',
    ],
    keywords: ['affiliate', 'referral', 'influencer', 'creator', 'commission', 'tds'],
  },
  access: {
    resources: [
      { resource: 'orders', level: 'read', why: 'Credits orders placed through a link or code' },
      {
        resource: 'customers',
        level: 'read-write',
        why: 'Affiliates sign up with their store account; checks orders are not their own',
      },
      { resource: 'discounts', level: 'write', why: 'Makes each affiliate’s personal code' },
      { resource: 'refunds', level: 'read', why: 'Lowers or reverses commission on refunds' },
      { resource: 'visits', level: 'read', why: 'Counts clicks on referral links' },
      {
        resource: 'order-events',
        level: 'read',
        why: 'Reacts when an order is paid, delivered, cancelled or returned',
      },
    ],
    summary: 'tracks referrals',
  },
  provides: {},
  storefront: { blocks: affiliateBlocks },
  // Share and earn: a one-tap invite on the thank-you page and in order emails.
  orderLinks,
  hooks: {
    'order.paid': async (ctx, payload) => {
      const row = await ctx.inStore(async (tx) =>
        creditOrder(
          tx,
          ctx.storeId,
          payload.orderId,
          await loadAffiliateSettings(tx, ctx.storeId),
          ctx.settingsSecret,
        ),
      )
      if (row && row.status === 'pending') ctx.reportActivity?.('Credited an order to an affiliate')
    },
    // Cash on delivery is paid at the door, so delivery credits too; then the hold starts.
    'order.delivered': async (ctx, payload) => {
      await ctx.inStore(async (tx) => {
        const settings = await loadAffiliateSettings(tx, ctx.storeId)
        await creditOrder(tx, ctx.storeId, payload.orderId, settings, ctx.settingsSecret)
        await startHold(tx, payload.orderId, settings)
        await approveDueCommissions(tx, ctx.storeId, settings)
      })
    },
    'order.cancelled': async (ctx, payload) => {
      await ctx.inStore((tx) => reverseCommission(tx, ctx.storeId, payload.orderId, 'cancelled'))
    },
    'order.rto': async (ctx, payload) => {
      await ctx.inStore((tx) => reverseCommission(tx, ctx.storeId, payload.orderId, 'rto'))
    },
    'refund.created': async (ctx, payload) => {
      await ctx.inStore((tx) => applyRefunds(tx, ctx.storeId, payload.orderId))
    },
  },
  admin: {
    icon: 'Users',
    pages: [
      { path: '', title: 'Affiliates overview', navLabel: 'Overview', icon: 'BarChart3' },
      { path: 'affiliates', title: 'Affiliates', navLabel: 'Affiliates', icon: 'Users' },
      { path: 'affiliates/[id]', title: 'Affiliate' },
      { path: 'programs', title: 'Programs', navLabel: 'Programs', icon: 'Blocks' },
      { path: 'programs/[id]', title: 'Program' },
      { path: 'commissions', title: 'Commissions', navLabel: 'Commissions', icon: 'FileText' },
      { path: 'creatives', title: 'Creatives', navLabel: 'Creatives', icon: 'Upload' },
      { path: 'payouts', title: 'Payouts', navLabel: 'Payouts', icon: 'CreditCard' },
      { path: 'settings', title: 'Settings', navLabel: 'Settings', icon: 'Settings' },
    ],
  },
})
