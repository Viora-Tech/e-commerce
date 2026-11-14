# Create shipment: drawers beside the sidebar, courier hover, pickup drawer shows one parcel (14 Nov 2026)

Branch `fix/pickup-drawer-courier-hover`. Owner reports from the live admin.

## 1. Bottom drawers no longer cover the left sidebar

The Create pickup, Select courier partner, Booked and bulk Ship drawers are Base UI bottom drawers
portalled to `<body>` with `inset-x-0`, so from `md` up they ran under/over the sidebar rail. The
rail's `--sidebar-width` variables live on the sidebar wrapper, out of the portal's reach.

- `lib/sidebar-motion.ts`: `SIDEBAR_WIDTH` (16rem) and `SIDEBAR_WIDTH_ICON` (3rem) now live here
  (admin-frame.tsx sets both CSS variables from them), plus `BESIDE_SIDEBAR`: from `md` up, a
  `:has()` rule on `<body>` reads the rail's `data-state` (expanded / collapsed) and sets the
  panel's `left` to the rail's width, the same `[body:has(...)_&]` pattern the save bar rules use.
- The four `DrawerContent`s in `components/shipments/create-shipment/` add `BESIDE_SIDEBAR`. On
  phones the rail is a sheet, so the drawer stays full width. The light backdrop still tints the
  whole window (it is the drawer primitive's own overlay).

## 2. Courier hover / picked state

- Cause: the picked row kept its `hover:` class. Tailwind's `.hover\:x:hover` outweighs a plain
  `.x`, so right after a click the new pick showed the hover colour (table: `bg-row-hover` over
  `bg-primary-soft`; step-2 cards: `border-border-strong` over `border-primary`, faded by
  `motion-press`) and only "arrived" when the pointer left.
- Second cause: the price breakdown under the picked row was mounted/unmounted at once, so every
  row below the old pick jumped up and the pointer landed on the next row.
- Fix: `courier-row-style.ts` (hover only on rows that are neither picked nor blocked), and
  `breakdown-reveal.tsx` (motion `AnimatePresence`, height + opacity over `base` 200ms, the old
  pick's breakdown closes while the new one opens; `instant` for reduced motion). The table keeps
  one always-present breakdown row per courier (no height when closed). Cards add
  `motion-reduce:transition-none`.

## 3. Create pickup after booking shows only that parcel

Owner: other booked parcels and pickup-day changes belong to Shipments → Booked (tick → Create
pickup) and the Pickups tab, which are unchanged.

- `pickup-parcel-list.tsx` lists only the anchor parcels (the ones the drawer was opened for), no
  tick boxes; `pickup-drawer.tsx` books / joins with those ids only. Joining keeps the
  "Delhivery is already coming …" line, without the other orders in it. Later leaves the parcel in
  Booked.
- Copy (en + hi): `parcels` is now "This parcel" / "These parcels · n"; removed `parcelsCount`,
  `bookedEarlier`, `earlierToday`, `alreadyIn`, `waiting`, `waitingJoin`, `tick`.
- `shipments.listPickupOptions` still returns the courier's other parcels (unchanged API); the
  drawer ignores them.

Tests: `pickup-drawer.test.tsx`, `courier-row-style.test.ts`, `lib/sidebar-motion.test.ts`.
