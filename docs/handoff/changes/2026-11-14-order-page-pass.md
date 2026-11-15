# Order page design pass (audit section 7, page 2)

Branch `design/page-order`, from 6e54fc581 (dev plus wave 2). Layout and consistency only:
every action, amount and flow on `/orders/[id]` and `/orders/[id]/edit` is unchanged.

Already right on dev (waves 1–2, not redone): the 1.5rem gutter and 23.5rem side column
(`OrderPageFrame` on `PageBody width="detail"` + `PageColumns`), DataCard on every card,
Button `loading` on refund, cancel, collect payment, bulk fulfil and Fulfil selected, the
`busy` close guard on every order popup, NextStepBanner and NoticeBar on `Alert`, profit and
returns cards holding their place with a DataCardSkeleton.

What changed:

- **Banners on `Alert` tones.** The hold banner is the warning tone with "Release hold" in the
  action slot at the end. The RTO strip in the Returns card is a danger `Alert` with Open in the
  action slot (was a hand-made red strip). The "edited after it shipped" note is the warning
  tone. The "message is switched off" note in Send message is a warning `Alert`.
- **Money popups.**
  - Cancel order: while the refund choices load, the refund block keeps its place with three
    row skeletons, so the reason and checkboxes no longer jump down. If the read fails, it says
    so with Try again (before, Cancel order stayed greyed out with no reason).
  - Refund: the "How to refund" choices are the same bordered rows as Cancel order and the edit
    review. The form now uses the popup shell's spacing (1rem) like the other popups.
  - Collect payment: the shell's spacing; Esc or a click outside now asks "Discard what you
    typed?" when the amount, method, reference or date was changed (before: only the reference).
  - Edit review: a skeleton while the new total is worked out, so Save does not jump down;
    shell spacing. The edit review's refund rows use the same radius as Cancel order.
- **Other popups.** Edit contact asks before Esc drops changes, and its Cancel is off while it
  saves. Send message: a failed preview shows the shared inline error with Try again; To,
  Subject and Message are `Field`s.
- **Cards.** Add note (timeline) and Save (profit, courier charge) show a spinner while saving;
  the courier charge sits in a `Field`. Order tags use the shared tag chip (StatusChip with an ×,
  as in every tag field), with a translated "Remove" label. The pack form's quantity boxes use
  the small Input size instead of a height override. The previous/next arrows no longer leave an
  unhandled error when their read fails.
- **Loading.** The order page skeleton has three header buttons, four main cards and three side
  cards, like the page usually opens. The edit page skeleton has no header buttons, two main
  cards and one side card.

Copy: `orderCancelContent.optionsFailed` and `orderDetailContent.tags.remove`, with Hindi.

Tests: `cancel-order-dialog.test.tsx` (refund block while loading, failure + Try again, busy
while cancelling) and `collect-payment-dialog.test.tsx` (Esc closes untouched, asks when
changed, stays open while recording).

Left alone: the Next step buttons and the header's Edit / Refund only dim while another action
runs (they open a popup or a page, they do not save themselves); the ship page (step 6 owns it);
the returns pages (`/orders/returns/[id]`, not under the order).
