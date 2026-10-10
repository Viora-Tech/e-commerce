# Discount detail: Pause / Resume and Duplicate

Branch `feat/discount-pause-duplicate`. No migration: "paused" is the existing `disabled` status,
which `evaluateDiscount` already rejects at checkout (covered by `evaluate.test.ts`).

- Header actions on `/discounts/[id]`: Pause (confirm dialog) / Resume, Duplicate, Delete. Hidden without `discounts:write`.
- New `discounts.duplicate` oRPC procedure (`duplicateDiscount` in `packages/api/src/services/discount.service.ts`): copy titled "<name> (copy)", code suffixed `-COPY`/`-COPY2`..., status disabled, usage reset. Test in `packages/api/test/discounts.test.ts`.
- Copy in `data/discounts.ts` + Hindi overlay.
- Also removed a duplicated `{copy.delete.confirm}` in the delete dialog.
- Figma: Marketing / Discount detail / Default (346:11736). Not checked in a browser (Chrome extension not connected in this session).
