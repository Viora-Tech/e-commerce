# Newsletter signup shows an error when it fails (#1574)

- `theme-actions/newsletter` (storefront) now redirects with `?form_posted=customer_error` when the
  signup is refused, instead of no flag. The theme engine already maps `<type>_error` to
  `form.errors`, so the theme's own error state shows (same as the contact form).
- Success is unchanged (`form_posted=customer`). Signups are double opt-in: the address joins the
  list only after the confirm email's link is clicked, so a store without a working email sender
  never confirms anyone.
