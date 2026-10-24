# Meta connect: use the catalog the merchant shared

- After the client_business_id fix, production failed at the next step:
  `catalogs: (#200) Requires business_management permission to manage the object`. A business
  integration system user token reaches only the assets shared with it in the sign-in window,
  not the business's own catalog list.
- With a login configuration, `metaDiscover` now reads `/me/assigned_product_catalogs` (ours by
  name, else the first shared) and `/me/assigned_whatsapp_business_accounts`. No shared catalog
  → "No catalog was shared. Connect again and choose (or create) a catalog in the Meta window."
- User tokens (no login configuration) keep the old owned-catalog flow.
- Meta app setting: in the "Catalog" login configuration, make the **Catalogs** asset required so
  the merchant must pick one.
