# Theme editor: where footer policy links come from (11 Nov 2026)

Issue #1486 (Claw Gears, imported Horizon).

- An imported theme's footer policy links (`shop.policies`) list only the policies published in
  Settings › Policies. A store with none shows nothing, and the block has only Size and Case.
- New `policies-source-note.tsx`: on an imported block or section whose type or name speaks of
  policies, the inspector says where the links come from, with an "Open Policies" button.
- Layers named the Policy links block "0.875rem" (its first text setting). `NOT_A_NAME` in
  `customize-liquid-tree.ts` now skips sizes in rem, em, %, vh, vw and pt, and `var(...)`. Test added.
- Not yet checked in the browser: the local editor would not load in dev mode. Unit tests, types
  and lint pass.
