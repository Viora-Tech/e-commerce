# Delivery options: courier list never shows a single card (19 Nov 2026)

- `resolve.ts` `courierList`: "Hide couriers that are slower and dearer" could hide every courier
  when the cheapest one was also the earliest, leaving shoppers one card. Now, when hiding leaves
  fewer than `MIN_LIST_CARDS` (3), the next cheapest hidden couriers come back (still priced at
  the pick plus the difference), up to the option's "Show at most".
- `config.ts`: "Show at most" defaults to 5 (was 3) for new options. Saved options keep their value.
- Help text for the hide switch says at least 3 always show (English and Hindi).
- Test: `resolve.test.ts` "never shows a single card when three couriers deliver".
- Owner decision: shoppers should see 3 to 5 courier choices, not 1.
