# Checkout no longer fails hydration (nested form)

**Branch** `fix/checkout-hydration` (from `main`), no migration.

- `/checkout` threw React hydration error #418 on every load. Cause: the discount code field
  (`apps/storefront/src/components/cart/discount-code-field.tsx`) rendered its own `<form>`,
  and the checkout summary sits inside the checkout `<form>`. A nested form is invalid HTML, so
  the browser dropped it from the server HTML and React's tree no longer matched; React then
  re-rendered the whole page on the client.
- The field now has no form of its own, like the gift card field beside it: **Apply** is a
  plain button and Enter in the input applies the code without submitting the checkout. Same
  behaviour on the cart page.
- Test: `discount-code-field.test.ts` renders the field inside a form and expects one form.
  Any new field that lives in the checkout summary must not render a `<form>` either.
- Not fixed here: the product page logs React's "unique key" warning from `ProductView` in
  development.
