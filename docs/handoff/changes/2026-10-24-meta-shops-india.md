# Instagram and Facebook: ads only in India

Commerce Manager refuses to create a shop for an Indian business: "Shops isn't available in your
country". So there is no shop tab and no product tags on Instagram or Facebook. The Meta catalog
still feeds ads (including dynamic product ads), and WhatsApp shows it on the business profile.

- `apps/admin/src/data/sales-channels.ts`: the Instagram and Facebook blurbs say this instead of
  promising a shop and product tags. No Hindi overlay exists for this file.
- Merchant guide `sales-channels/social-media.mdx`: a callout says the same.
