# Create pickup: Today is closed after 2 pm, even with a pickup booked

**What:** In the Create pickup drawer, the Today card greys out from the 2 pm cut-off even when a
pickup was already booked for today, and the drawer never starts on it then (it starts on the
first open day with a booked pickup, else the first open day). The "Pickup booked · 14:00" tag
still shows on it. Files: `pickup-day-cards.tsx`, `pickup-plan.ts` (`startingPickupDay`).

**Why:** Owner, 23 Nov evening: Today (Mon 23 Nov) was still clickable at night because a 14:00
pickup had been booked that day; joining a pickup whose time has passed makes no sense.

**Tests:** `pickup-plan.test.ts` 7/7 (the booked-today case now starts on tomorrow).
