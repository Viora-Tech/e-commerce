# Theme import reads Shopify's ZIP64 sizes

Shopify theme exports can keep each file's sizes in a ZIP64 extra field, with `0xFFFFFFFF` in the central directory. The reader took those as 4 GB, skipped every file and reported that `layout/theme.liquid` was missing.

`zipEntries` now reads the real sizes from the extra field. The file, total and inflate budgets work as before, on the real sizes.

Tested with `archive-zip64.test.ts` and the Claw Gears Horizon 3.2.1 export (412 files read).
