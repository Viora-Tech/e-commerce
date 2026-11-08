import { definePlugin, permissions } from '@core/plugin-sdk'
import addToCart from './modules/add-to-cart'
import cartCount from './modules/cart-count'

/**
 * Koomerce shop plugin for Instatic (evaluation, Nov 2026).
 *
 * - Loop source `koomerce.products`: catalogue products, baked at publish time.
 * - Loop source `koomerce.products.live`: same fields, request-dependent, so a loop
 *   using it becomes an Instatic "dynamic hole" rendered at request time.
 * - Module `koomerce.shop.add-to-cart`: a button whose tiny runtime posts the
 *   Shopify-shaped body our storefront already accepts to `/cart/add.js`.
 * - Module `koomerce.shop.cart-count`: header badge filled from `/cart.js`.
 */
export default definePlugin({
  id: 'koomerce.shop',
  name: 'Koomerce shop',
  version: '0.1.3',
  description: 'Koomerce products as loop sources, plus add-to-cart and cart-count modules.',
  permissions: [permissions.loopsRegister, permissions.modulesRegister, permissions.frontendAssets],
  modules: [addToCart, cartCount],
})
