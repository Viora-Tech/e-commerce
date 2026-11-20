# Manifest reference (short)

Condensed from `apps/docs/content/developer-docs/building/plugins.mdx`. The types are the truth:
`packages/plugins/src/types.ts`.

## Minimal connection manifest

```ts
import { definePlugin } from '@commerce/plugins'
import { fedexFactory } from './fedex'

export const fedexPlugin = definePlugin({
  id: 'fedex',
  name: 'FedEx',
  version: '0.1.0',
  kind: 'connection',
  category: 'shipping',
  company: 'FedEx',
  description: 'Rates, labels and tracking on your FedEx account.',
  access: {
    resources: [
      { resource: 'shipments', level: 'read-write', why: 'Creates shipments, prints labels, tracks parcels' },
      { resource: 'customers', level: 'read', why: 'Name, phone and address, for the parcel only' },
    ],
    shares: [{ when: 'Sent per shipment', what: 'Ship-to name, address and phone, parcel weight and size' }],
  },
  provides: { shipping: [fedexFactory] },
  // tested: true,   // only after the owner ran it end to end on a live store
})
```

## Access resources

`orders`, `order-events`, `customers`, `products`, `inventory`, `shipments`, `payments`,
`refunds`, `invoices`, `reviews`, `collections`, `discounts`, `gift-cards`, `store-pages`,
`content`, `files`, `store-settings`, `visits`. Each at most once, with `level` `read`, `write`
or `read-write` and a `why`. `access.summary` (optional) is a few words shown after the level.

## Optional manifest fields

| Field | Use |
| --- | --- |
| `provides` | `payments`, `shipping`, `notifications`, `storage` factories (fields drive the settings form; `secret: true` fields are encrypted and masked) |
| `hooks` | `order.paid`, `order.fulfilled`, `order.delivered`, `refund.created`, `customer.created`, `customer.updated`; idempotent |
| `jobs` | Named background jobs, queued with `enqueueAppJob(...)` |
| `orderLinks`, `emailAttachments` | Shopper order page links and order email files |
| `productFields` | Variant fields on the product form (platform columns only) |
| `admin.icon`, `admin.pages`, `admin.orderDetailCard`, `admin.customerDetailCard`, `admin.orderActions` | Admin surfaces |
| `storefront.blocks` | App blocks (`<pluginId>/<Name>`) |
| `listing` | App Store page: tagline, highlights, guide, worksWith, keywords, screenshots, faq, unlisted |
| `credits` | Open-source credit shown on the Apps card |
| `setupState(settings)` | Connected / Needs setup / Error for apps that keep their own connection |
| `tested` | `true` hides the "Untested" badge; only after a live end-to-end run |

## Order actions

`admin.orderActions: [{ id, label: { en, hi }, targets: ['detail' | 'row' | 'bulk'], handler, permission?, requires? }]`.
Handlers: `link` (admin path with `{orderId}` / `{orderIds}`), `procedure` (namespaced
`<pluginId>/<name>`, registered in `apps/admin/src/apps/order-action-procedures.ts`), `shipment`
(a courier the plugin provides). Couriers get "Create shipment" for free. `requires`: `open`,
`unfulfilled`, `paid-or-cod`, `not-test`. The procedure still checks its own permission and the
installed app; menus are a convenience, never the guard.

## Provider rules

- Throw `CourierError` for transport or auth failures; return `serviceable: false` for a real no.
- Never call `Date.now()` for delivery dates: return transit days.
- Payment webhooks verify with a constant-time compare and return a stable `eventId`.
- Notifications `send` returns `{ ok, providerRef?, error? }`; never throw for a rejected recipient.
- Outbound calls to merchant-supplied hosts go through `@commerce/core/safe-fetch`.

## Ship it

1. Add the package to `commerce.config.ts` (and, if it has blocks, to `commerce.blocks.config.ts`).
2. Add `"@commerce/<pkg>": "workspace:*"` where `@commerce/plugin-back-in-stock` appears (root,
   `apps/admin`, `apps/storefront`, `apps/worker`, `packages/api`). Installing packages needs the
   owner's OK on this machine (see `koomerce-testing`).
3. With a `listing`, run `bun scripts/gen-app-catalogue.ts`.
4. Add a handoff note in `docs/handoff/changes/`.
