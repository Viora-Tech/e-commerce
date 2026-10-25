# Release test fixes

- `storefront-cache.ts`: the Affiliates v1.1 tables (`affiliate_blocklist`, `affiliate_click_day`, `affiliate_code`, `affiliate_creative`) are classified as cache-exempt (admin data or the affiliate's own dashboard).
- `isDeletionCode` (Meta data-deletion confirmation): the MAC is base64url and may contain `-`, so the code is split at the first dash (the body never has one). Before, codes with a dash in the MAC failed the check now and then; a 300-code loop guards it.
