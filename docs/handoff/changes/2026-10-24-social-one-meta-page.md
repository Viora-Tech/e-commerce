# Social media: one Meta page with tabs

The sidebar listed Instagram, Facebook and WhatsApp as separate items, even though they share one
Meta sign-in and one catalog (#711). Social media now has two items: **Meta** and **Google**.

- `/sales-channels/social/meta?surface=facebook|instagram|whatsapp` is the Meta page, with tabs
  (`PillTabs`) for the three surfaces. With no `surface`, it opens the first surface that is on.
- `routes.salesChannels.socialChannel(c)` returns the Meta URL for a Meta surface, so every
  existing link (Meta connection card, order card, connect callback) lands on the right tab.
- Old `/social/instagram` style URLs redirect and keep `?connect=`. The page's toast cleanup now
  drops only `connect` and keeps `surface`.
