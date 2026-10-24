# Built-in app icon family

- Our own apps draw a designed icon (coloured squircle tile + custom mark) from `public/app-icons/<id>.svg` in the admin and on the App Store site, mapped in `APP_ICONS` (`@commerce/core/app-logos`).
- Covers reviews, gst-invoices, back-in-stock, emi-pay-later, forms, shopify-import, affiliates, automations, search, plus pixels and inbox ahead of those apps.
- Third-party logos are unchanged; apps without an icon keep the gradient glyph tile. The `app-catalogue` sweep now checks icons ship on both sites.
