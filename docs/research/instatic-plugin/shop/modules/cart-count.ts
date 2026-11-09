import { defineModule, html } from '@core/plugin-sdk'

/** Header cart link with a count badge, filled from `/cart.js` after load (never baked). */
const RUNTIME = `(function(){function go(){fetch('/cart.js',{headers:{accept:'application/json'}}).then(function(r){return r.ok?r.json():null}).then(function(c){if(!c)return;document.querySelectorAll('[data-koomerce-cart-count]').forEach(function(el){el.textContent=String(c.item_count||0);el.hidden=!c.item_count;});}).catch(function(){});}
if('requestIdleCallback' in window)requestIdleCallback(go);else setTimeout(go,1);})();`

export default defineModule({
  id: 'koomerce.shop.cart-count',
  name: 'Cart link',
  description: 'Cart link with the live item count.',
  category: 'Shop',
  htmlTag: 'a',
  defaults: { label: 'Cart' },
  schema: {},
  render: ({ props }) => ({
    html: html`<a class="k-cart" href="/cart">${props.label} <span class="k-cart-n" data-koomerce-cart-count hidden>0</span></a>`,
    css: `.k-cart{color:inherit;text-decoration:none;font-weight:600}.k-cart-n{display:inline-grid;place-items:center;min-inline-size:1.25rem;block-size:1.25rem;margin-inline-start:.25rem;border-radius:999px;background:#e11d48;color:#fff;font-size:.75rem}`,
    js: RUNTIME,
  }),
})
