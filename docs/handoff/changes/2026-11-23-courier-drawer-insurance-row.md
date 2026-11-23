# Courier drawer: Shipping insurance on its own row

**What:** In Select courier partner (`create-shipment/courier-drawer.tsx`), the Shipping insurance
toggle and its notes (uninsured limit, RapidShyp Shield, used goods) moved out of the header into
a full-width row above the All / Air / Surface tabs. The header keeps the title, the route summary
and Close.

**Why:** Owner, 23 Nov: squeezed beside Close, the insurance box wrapped onto two lines and crowded
Check again and Sort under it.

**Tests:** none touch the layout; Biome clean.
