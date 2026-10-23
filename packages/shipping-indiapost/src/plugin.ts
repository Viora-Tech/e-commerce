import { definePlugin } from '@commerce/plugins'
import { deliveryCheckerBlocks } from './blocks'
import { indiaPostFactory } from './india-post'

/**
 * Listed in commerce.config.ts; a store installs it from Admin -> Apps, then sets it up from the
 * app's own Connect page (`/apps/india-post/connect`). Booking is at the post office counter: the
 * merchant types the article number from the receipt, we print the label and keep the status.
 * Works alongside the other couriers in the shared Shipments workspace (Orders -> Shipments).
 */
export const indiaPostPlugin = definePlugin({
  id: 'india-post',
  name: 'India Post',
  version: '0.1.0',
  kind: 'connection',
  category: 'shipping',
  company: 'Department of Posts',
  description:
    'Speed Post parcels to every PIN code in India: published rates, address labels and COD.',
  listing: {
    tagline: 'Speed Post to every PIN code in India, with labels and COD.',
    highlights: [
      'Published Speed Post rates',
      'Address labels to print',
      'COD parcels and their status',
    ],
    guide: '/merchant-guide/apps/india-post',
    worksWith: [
      'The Shipments workspace, beside any other courier you install',
      'Courier rules in Settings → Shipping',
      'Delivery checker block in your theme',
    ],
    keywords: ['speed post', 'courier', 'post office'],
  },
  access: {
    resources: [
      {
        resource: 'orders',
        level: 'read-write',
        why: 'Reads orders to book parcels; a status you set to delivered marks them delivered',
      },
      {
        resource: 'shipments',
        level: 'read-write',
        why: 'Records article numbers, prints labels, keeps the parcel status',
      },
      { resource: 'customers', level: 'read', why: 'Name, phone and address, for the label only' },
      { resource: 'products', level: 'read', why: 'Weight and size, for the Speed Post rate' },
    ],
    shares: [
      {
        when: 'Only with a data.gov.in API key, per PIN code looked up',
        what: 'The PIN code itself (never a name, address or order)',
      },
    ],
  },
  provides: { shipping: [indiaPostFactory] },
  storefront: { blocks: deliveryCheckerBlocks },
  admin: {
    icon: 'Truck',
    pages: [
      { path: '', title: 'India Post', navLabel: 'Parcels', icon: 'Truck' },
      { path: 'connect', title: 'Set up India Post', navLabel: 'Connect', icon: 'Settings' },
      { path: 'labels/[waybill]', title: 'India Post label' },
    ],
  },
})
