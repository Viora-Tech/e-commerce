# Remember guest checkout details; Settings and Growth widths

- **Storefront checkout:** a guest's contact and delivery details (name, email, phone, address,
  PIN) are remembered in the browser's localStorage (`lib/checkout-remember.ts`) and prefill the
  next checkout on the same device, which then opens as a guest. Never payment, GSTIN, notes or
  gift cards; dropped after 90 days; never used for signed-in shoppers (their account prefills).
  Before, the only memory was the per-tab, per-cart sessionStorage draft, so every new cart or
  tab started empty.
- **Admin Settings:** the area is centred at Home's width (`max-w-[68rem]`) instead of full width.
- **Admin Growth:** the outcomes card fills the row when there is no "best source" callout
  (it used to sit alone in a 1.6fr column).
