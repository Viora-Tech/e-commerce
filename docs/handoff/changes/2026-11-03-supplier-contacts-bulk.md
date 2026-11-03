# Supplier contacts and bulk edit (#1064)

- `supplier.contacts` jsonb (migration **0221_supplier_contacts**, default `[]`): extra ways to
  reach a supplier, `{ kind, value, label? }` with kinds in core `SUPPLIER_CONTACT_KINDS`
  (whatsapp, wechat, phone, email, website, other), max 10. `SupplierInputSchema.contacts` is
  optional and a save without it keeps the existing ones (quick-add dialog, bill reading).
  Admin: `components/suppliers/supplier-contacts-field.tsx` in the supplier's Contact card.
  Address already existed (`supplier.address`).
- Bulk edit on the suppliers list (`supplier-bulk-actions.tsx`): tick currency / country /
  payment terms and apply to all selected via new `suppliers.bulkUpdate` → core
  `updateSuppliers` (store-scoped, only given fields; empty terms clears). Bulk delete reuses
  `suppliers.delete`. No archive yet: suppliers have no archived state.
- Also formats two copy lines from #1072 that went in unformatted.
- Also sorts the `line-weight` export in `core/src/index.ts` (biome organizeImports, from #1072).
