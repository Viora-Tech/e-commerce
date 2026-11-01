# Gift cards: customer list and usage limit (#992, #993)

- #992: the customer page has a Gift cards card (last four characters, balance of issued, state), using the existing `giftCards.forCustomer`. The full code still shows only once, at issue.
- #993: migration **0199_gift_card_usage_limit** adds `gift_card.usage_limit` (null means no limit) and `use_count`. Each checkout that spends the card adds 1 (`redeemGiftCards`). Once `use_count` reaches the limit, checkout refuses the card with "used the most times allowed". It's set on the gift card page (Usage limit card) through `giftCards.update`. A refund does not give a use back.
- Drizzle numbered the migration 0183 (the journal skips numbers). It was renamed to 0199, and the real 0183 snapshot was restored.
