# Settings search results no longer cut off

- `apps/admin/src/components/settings/settings-search.tsx`: the results box was fixed at 20rem
  while the settings menu column (`settings/layout.tsx` aside) is `w-60` with `overflow-y-auto`,
  which clips anything wider. Result titles were cut mid-word ("Razorpay, Cashfree and other pa").
  The box now takes the menu's width and titles wrap. Checked on the live admin by applying the
  same classes in the browser.
