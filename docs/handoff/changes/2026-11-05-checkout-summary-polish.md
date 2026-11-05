# Checkout summary polish, express checkout off

`summary-items.tsx` scrolls a long order with no scrollbar and a fade, and keeps the quantity badge
clear (the theme resets padding on a list, so it sits on a wrapper). The summary card hides its own
scrollbar too. Express checkout is commented out in `checkout-form.tsx` for now, at the merchant's
request; the comment there says what to restore.
