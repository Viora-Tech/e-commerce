# Manifest fields

Source: `packages/plugins/src/types.ts` in the Koomerce repo. Optional unless marked required.

| Field | Notes |
| --- | --- |
| `id` (required) | Lowercase slug, stable forever |
| `name`, `version` (required), `description` | Shown on the Apps card |
| `kind` (required) | `'builtin'` (runs inside the platform, no outside account) or `'connection'` (needs another company's account) |
| `company`, `category` | For connections: "by <company>" and a filter chip (`storage`, `payments`, `shipping`, `messages`, `analytics`, `marketing`) |
| `access` (required) | `resources: [{ resource, level, why }]`, `summary?` (a few words), `shares?: [{ when, what }]` |
| `provides` | `payments`, `shipping`, `notifications`, `storage`: arrays of provider factories |
| `hooks` | Event handlers, run in the worker on the apps events queue; idempotent |
| `jobs` | Named background jobs the app queues for itself |
| `orderLinks`, `emailAttachments` | Links on the shopper's order page and order emails; files attached to an order email |
| `productFields` | Variant fields shown on the product form while installed |
| `admin.icon` | Icon name for the sidebar and the app header |
| `admin.pages` | `[{ path, title, navLabel?, icon? }]`, `path: ''` is the app root |
| `admin.orderDetailCard`, `admin.customerDetailCard` | Cards on the order and customer pages |
| `admin.orderActions` | Actions in the order page's More actions, the list row menu and the bulk bar |
| `storefront.blocks` | App blocks for the theme editor's Apps tab |
| `listing` | App Store page: `tagline`, `highlights`, `guide`, `worksWith`, `keywords`, `screenshots`, `faq`, `unlisted` |
| `credits` | `[{ name, url, license, note }]` for adapted open source |
| `setupState(settings)` | `{ connected, problem }` for apps that keep their own connection in settings |
| `tested` | Set by the maintainers after a live end-to-end run |

## Access resources

`orders`, `order-events`, `customers`, `products`, `inventory`, `shipments`, `payments`,
`refunds`, `invoices`, `reviews`, `collections`, `discounts`, `gift-cards`, `store-pages`,
`content`, `files`, `store-settings`, `visits`. Each at most once.

## Example

```ts
import { definePlugin } from '@commerce/plugins'
import { exampleCourierFactory } from './courier'

export const exampleCourierPlugin = definePlugin({
  id: 'example-courier',
  name: 'Example Courier',
  version: '0.1.0',
  kind: 'connection',
  category: 'shipping',
  company: 'Example Courier',
  description: 'Rates, labels and tracking on your Example Courier account.',
  access: {
    resources: [
      { resource: 'shipments', level: 'read-write', why: 'Creates shipments, prints labels, tracks parcels' },
      { resource: 'customers', level: 'read', why: 'Name, phone and address, for the parcel only' },
    ],
    shares: [{ when: 'Sent per shipment', what: 'Ship-to name, address and phone, parcel weight and size' }],
  },
  provides: { shipping: [exampleCourierFactory] },
})
```

## Order action handlers

| `type` | What happens |
| --- | --- |
| `link` | Opens an admin route (`{orderId}`, `{orderIds}` filled in) |
| `procedure` | Runs an API procedure registered under `<pluginId>/<name>` |
| `shipment` | Opens Create shipment with one of the plugin's couriers |

Conditions (`requires`): `open`, `unfulfilled`, `paid-or-cod`, `not-test`. The bulk bar always
offers the action, so the handler must skip orders it cannot act on.
