# Writing a plugin

Payment gateways, couriers and notification channels are plugins. The platform
never imports an adapter directly: `commerce.config.ts` lists plugins, each
store installs the ones it wants from **Admin → Apps**, and the installed
plugins' providers show up under **Settings → Payments / Shipping /
Notifications**. Nothing about a provider is hard-coded in the admin — the
form is generated from the fields your factory declares.

```
commerce.config.ts          which plugins this deployment ships
packages/plugins            definePlugin, defineConfig, loadPlugins
packages/payments           PaymentProvider contract + conformance suite
packages/shipping           ShippingProvider contract + conformance suite
packages/notifications      NotificationChannel contract + conformance suite
packages/storage            StorageProvider contract (presigned uploads) + conformance suite
packages/*-razorpay etc.    reference adapters, one package each
```

## 1. Package layout

A plugin is an npm package (workspace or published) that exports a manifest.

```
packages/shipping-fedex/
  package.json        depends on @commerce/shipping and @commerce/plugins
  src/fedex.ts        the provider + its factory
  src/plugin.ts       the manifest
  src/index.ts        re-exports
  test/fedex.test.ts  offline tests + the conformance suite
```

`package.json`:

```json
{
  "name": "@commerce/shipping-fedex",
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "@commerce/plugins": "workspace:*",
    "@commerce/shipping": "workspace:*"
  }
}
```

Published to npm, the dependencies become the released versions and the
merchant adds your package to their deployment's `commerce.config.ts`.

## 2. The provider and its factory

Each kind has a contract and a factory type. The factory is what the registry
holds: `fields` drive the settings form, `validateConfig` runs on save, and
`create` builds a provider from one store's decrypted config.

```ts
// src/fedex.ts
import {
  CourierError,
  courierFetch,
  courierJson,
  type ShippingProvider,
  type ShippingProviderFactory,
} from '@commerce/shipping'

export type FedexConfig = {
  accountNumber: string
  apiKey: string
  apiSecret: string
  originPincode: string
}

export class FedexProvider implements ShippingProvider {
  readonly id = 'fedex'
  readonly label = 'FedEx'
  constructor(private readonly config: FedexConfig) {}

  async checkServiceability(q) { /* GET rates, map to Serviceability */ }
  async createShipment(input) { /* POST ship, return { waybill, labelUrl, providerRef } */ }
  async track(waybill) { /* map FedEx scan codes to the normalised status */ }
  async cancel(waybill) { /* ... */ }
  async verifyCredentials() { /* one cheap authenticated call */ }
}

export const fedexFactory: ShippingProviderFactory<FedexConfig> = {
  id: 'fedex',
  label: 'FedEx',
  fields: [
    { key: 'accountNumber', label: 'Account number', required: true },
    { key: 'apiKey', label: 'API key', secret: true, required: true },
    { key: 'apiSecret', label: 'API secret', secret: true, required: true },
    { key: 'originPincode', label: 'Pickup PIN code', required: true },
  ],
  validateConfig(raw) {
    const r = (raw ?? {}) as Partial<FedexConfig>
    const missing = ['accountNumber', 'apiKey', 'apiSecret', 'originPincode'].filter(
      (k) => !r[k as keyof FedexConfig],
    )
    return missing.length
      ? { ok: false, errors: [`missing ${missing.join(', ')}`] }
      : { ok: true, config: r as FedexConfig }
  },
  create: (config) => new FedexProvider(config),
}
```

Rules that keep every adapter interchangeable:

- **Ids are lowercase slugs** and stable forever — they are stored in orders.
- **Fields marked `secret: true` are encrypted at rest** and masked in the admin
  (`••••1234`). Validators see a placeholder for them, so only check presence.
- **Throw `CourierError` for transport/auth failures**; return
  `serviceable: false` for a genuine "no". The platform falls back on the first
  and tells the shopper the second.
- **Never call `Date.now()` for delivery dates.** Return transit days; the
  platform's calendar (`@commerce/shipping` `delivery-date.ts`) turns them into
  a date in the store's timezone with cutoff and holidays applied.
- Payments: `createPayment` returns a `CheckoutSession` of kind `client`,
  `redirect`, `manual` or `none`; `parseWebhook` must verify the signature with
  a constant-time compare and return a stable `eventId` for deduplication.
- Notifications: `send` returns `{ ok, providerRef?, error? }`; never throw for
  a rejected recipient.

## 3. The manifest

```ts
// src/plugin.ts
import { definePlugin } from '@commerce/plugins'
import { fedexFactory } from './fedex'

export const fedexPlugin = definePlugin({
  id: 'fedex',
  name: 'FedEx',
  version: '0.1.0',
  description: 'Rates, labels and tracking on your FedEx account.',
  provides: { shipping: [fedexFactory] },
})
```

A plugin may provide several kinds at once (`payments`, `shipping`,
`notifications`, `storage`) — an aggregator like Shiprocket would list couriers
under `shipping` and its COD remittance under `payments`.

### Storage providers

`@commerce/storage` is the contract for where uploads live. The browser asks
the API for a presigned request, PUTs the bytes straight to the store, then
confirms; a provider only signs (`presignUpload`), names (`publicUrl`) and
deletes. See `packages/storage-r2` for the S3-compatible reference (Cloudflare
R2) and `packages/core/src/providers/local-storage.ts` for the development
folder. An S3, GCS or Bunny adapter is the same ~150 lines with a different
client.

## 4. Tests

Run the conformance suite from your own test file; it checks the behaviour
every provider must share. Offline checks always run; live checks only when
you pass `live: true` with sandbox credentials from the environment.

```ts
// test/fedex.test.ts
import { describeShippingProvider } from '@commerce/shipping'
import { fedexFactory } from '../src'

describeShippingProvider('fedex', {
  create: () => fedexFactory.create({ /* fake config */ }),
  live: Boolean(process.env.FEDEX_API_KEY),
})
```

Mock `fetch` for the rest: one test per API call, plus the tampered/expired
cases for webhooks.

## 5. Ship it

1. Add the package to `commerce.config.ts`:

   ```ts
   import { fedexPlugin } from '@commerce/shipping-fedex'
   export default defineConfig({ plugins: [razorpayPlugin, delhiveryPlugin, fedexPlugin] })
   ```

   Two plugins with the same id, or two providers with the same id in one
   kind, fail at boot with a message naming both.

2. Restart the apps. **Admin → Apps** now lists FedEx; a merchant installs it
   for their store and fills the credentials under **Settings → Shipping**.
   Uninstalling removes it from the enabled list but keeps the credentials, so
   reinstalling restores the setup.

3. Publish to npm (`@yourorg/commerce-plugin-fedex` or similar). Consumers add
   it to their config exactly the same way.
