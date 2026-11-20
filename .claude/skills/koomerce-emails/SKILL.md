---
name: koomerce-emails
description: Build or change Koomerce transactional emails and WhatsApp messages in packages/notifications - template ids, copy, the shared email blocks (ticket, notice, facts, items, button and more) and the per-template composers, sample data, previews and template tests. Use when adding a new message type, redesigning an email from the Figma batches, adding a TemplateData field, or debugging how a notification renders.
metadata:
  checked-against: "dev and feat/email-redesign-base, 20 Nov 2026"
---

# Emails and notifications

`packages/notifications` is the channel contract, registry, templates and conformance suite.
Channels are plugins: `packages/notifications-ses`, `-resend` (platform sender's second
transport), `-whatsapp`. Sending and data assembly live in core:
`packages/core/src/notifications/` (`deliver.ts`, `deliver-data.ts`, `preview.ts`).

## State of the code (read first)

- **On `dev`**: every email renders through `TransactionalEmail`
  (`packages/notifications/src/emails/transactional-email.tsx`) with the parts in
  `emails/components.tsx`, `layout.tsx` and `theme.ts`.
- **On branch `feat/email-redesign-base`** (not merged to `dev` yet; handoff note
  `docs/handoff/changes/2026-11-20-email-redesign-blocks.md` on that branch): every email is
  built from shared blocks plus a composer per template. Check `git log origin/dev` for the merge
  before relying on the block paths below; until then, work on that branch.

## Templates (both)

- Ids: the `TemplateId` union (`src/types.ts` on `dev`; `src/template-ids.ts` on the redesign
  branch) and `TEMPLATE_IDS` / `TEMPLATE_NAMES` in `src/templates/index.ts`.
- Render: `renderEmail(template, data)` (subject, text, html) and `renderWhatsapp(template, data)`
  in `src/templates/index.ts`. The plain-text part always carries the full copy.
- Copy: headings and intros per template in `src/templates/content.ts`, `content-parts.ts`,
  `content-split.ts`, `content-pay-online.ts`. Copy stays in these files, never in components.
- Sample data for the conformance suite, dev preview and admin preview: `src/samples.ts`
  (`sampleTemplateDataFor`).

## Blocks and composers (redesign branch)

- Blocks: `packages/notifications/src/emails/blocks/` (`index.tsx` exports the `EmailBlock`
  union and `BlockList`; `boxes.tsx` notice/status/facts/stats/columns/quote, `codes.tsx`
  code/coupon, `media.tsx` attachment/product/products, `parcels.tsx`, `ticket.tsx`,
  `tokens.ts`). Plus items, button, divider, text and links in `index.tsx`.
- Composers: `src/templates/compose/<batch>.ts` (codes, delivery, updates, payments, returns,
  account, marketing, team, order, order-placed), all registered in `COMPOSERS` in
  `compose/index.ts`. `composeEmail` returns `{ eyebrow, heading?, lead?, ownsNote?, blocks }`
  or null (null falls back to the legacy `TransactionalEmail` fields).
- Words around blocks: `templates/content-blocks.ts`, `content-blocks-2.ts`; footer "why you got
  this" line: `templates/content-footer.ts`.

**Rule (owner, 19 Nov 2026): build from shared blocks, not one-off components per email.** If a
Figma frame needs something new, add or extend a block so later templates reuse it; a composer
only picks blocks and fills them from `TemplateData`.

## Adding a message type

1. Add the id to the `TemplateId` union, `TEMPLATE_IDS` and `TEMPLATE_NAMES`.
2. Add its copy (heading, intro, subject; WhatsApp text) in the content files.
3. On the redesign branch: write its composer in the right `compose/<batch>.ts` file and register
   it in `COMPOSERS`.
4. Add sample data so previews and the conformance suite render it.
5. New `TemplateData` field: fill it at send time in `packages/core/src/notifications/` (event
   data), or pass it from an app through `ctx.notify(...)`.
6. If merchants edit it, it shows in Settings, Notifications; WhatsApp needs an approved Meta
   template of the same name (`packages/notifications-whatsapp/src/template-specs.ts`).
7. Handoff note in `docs/handoff/changes/`.

## Tests

```sh
cd packages/notifications && bunx vitest run
```

`test/templates.test.ts` (every template renders), `test/store-credit.test.ts`,
`test/fallback.test.ts`, and on the redesign branch `test/blocks.test.ts`. No database needed.
Email HTML uses `@react-email/components` with inline `style` objects and colours from
`emails/theme.ts`, not Tailwind classes (email clients do not run it). The existing email code
writes those inline sizes in px; follow the surrounding code there.
