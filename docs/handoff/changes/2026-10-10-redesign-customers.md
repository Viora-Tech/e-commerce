# Admin redesign: Customers

Branch `feat/proofly-customers`. Proofly look for the customer list, customer page and segments
(Figma `YmMNC5JOimqg61sI0eFI5a`: list `302:13662`, detail `304:14753`, unsaved `304:17015`, new
customer `304:19293`). Presentation only; no API or schema change.

- List: title + plain summary line, four stat cards that filter the tabs (total, new, repeat,
  subscribed), segmented tabs, shared table with centred status chip, open arrow + ⋯ menu (email,
  WhatsApp, delete), rows-per-page in the URL (`?perPage=`), error state, bulk bar (tag, export,
  email in Bcc). The overview chart card and the "Customer id" column are gone (not in the design);
  `customers.overview` stays in the API.
- Customer page: back link, avatar, name with chips (New / Returning / VIP), "Customer since ... ·
  city", Email customer + ⋯ (Edit, Delete). Next step card only when orders back it (VIP thank-you,
  win-back after 90 days). Orders card (last 5, View all via orders search by email), Timeline
  (orders placed + messages sent), Messages sent. Side: Contact (copy, WhatsApp, Call), Addresses,
  Marketing consent (unchanged behaviour and privacy tools), Notes with the floating save bar,
  Tags, Lifetime.
- Segments: list as a table card, builder with live count card, shared not-found state.
- `routes.*` everywhere in the area (allow-list entries removed), Hindi overlay `data/hi/customers.ts`
  (segment builder strings still English), `lib/customer-contact.ts` for wa.me / tel links.
- Shared, additive: `StatTile` `note` prop, `Phone` icon.

Not done: Add customer (no create API), abandoned-cart Next step and cart/campaign timeline
events (no data), comment box on the timeline (no model; Notes covers it).
