import { control, defineModule, html } from '@core/plugin-sdk'

/**
 * Add-to-cart button. The HTML is static and baked; one small deduped script per
 * page (`/_instatic/module-js/koomerce.shop.add-to-cart.js`) handles every button
 * by event delegation and posts the body Shopify themes send, which our
 * storefront already answers (`/cart/add.js` -> `/theme-actions/cart-add`).
 */
const RUNTIME = `(function(){
function count(n){document.querySelectorAll('[data-koomerce-cart-count]').forEach(function(el){el.textContent=String(n);el.hidden=!n;});}
document.addEventListener('click',function(e){
var b=e.target&&e.target.closest&&e.target.closest('[data-koomerce-add]');
if(!b||b.disabled)return;
e.preventDefault();
var id=b.getAttribute('data-koomerce-add');var label=b.textContent;
b.disabled=true;b.setAttribute('aria-busy','true');b.textContent='Adding';
fetch('/cart/add.js',{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},credentials:'same-origin',body:JSON.stringify({items:[{id:id,quantity:1}]})})
.then(function(r){if(!r.ok)throw new Error(String(r.status));return fetch('/cart.js',{headers:{accept:'application/json'}});})
.then(function(r){return r.json();})
.then(function(c){count(c.item_count||0);b.textContent='Added';})
.catch(function(){b.textContent='Try again';})
.finally(function(){b.removeAttribute('aria-busy');setTimeout(function(){b.disabled=false;b.textContent=label;},1500);});
});
})();`

export default defineModule({
  id: 'koomerce.shop.add-to-cart',
  name: 'Add to cart',
  description: 'Adds a product variant to the Koomerce cart.',
  category: 'Shop',
  htmlTag: 'button',
  defaults: {
    variantId: '{currentEntry.variantId}',
    label: 'Add to cart',
    availability: '{currentEntry.availability}',
  },
  schema: {
    variantId: control.text('Variant id'),
    label: control.text('Label'),
    availability: control.text('Availability (in-stock / sold-out)'),
  },
  render: ({ props }) => {
    const sold = props.availability === 'sold-out'
    return {
      html: sold
        ? html`<button type="button" class="k-atc" disabled>Sold out</button>`
        : html`<button type="button" class="k-atc" data-koomerce-add="${props.variantId}">${props.label}</button>`,
      css: `.k-atc{inline-size:100%;min-block-size:2.75rem;border:0;border-radius:.5rem;background:#111;color:#fff;font:600 .9375rem/1 var(--font-body,system-ui);cursor:pointer}.k-atc:disabled{background:#d4d4d4;color:#555;cursor:not-allowed}.k-atc[aria-busy=true]{opacity:.7}`,
      js: RUNTIME,
    }
  },
})
