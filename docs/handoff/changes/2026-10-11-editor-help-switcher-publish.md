# Theme editor: Help panel, page switcher popover, Save beside Publish (2026-10-11)

This adds the rest of the builder frames. Theme settings and Page settings came in #426.

- **Help panel** (Figma 381:8563): the rail's help button opens a panel with every real shortcut and its keys, the editor guide and what's new.
- **Page switcher popover** (369:125349): 360px wide, with the Pages panel's look, each kind's glyph, "New page" and the keys at the foot.
- **Save and Publish** (369:126247), kept in its own commit so it can be reverted alone:
  - The chip reads "Unsaved changes" while there are changes.
  - On a draft theme, Save (outline, only shown with changes) sits beside Publish. Publish saves first, then makes the theme live.
  - On the live theme, saving is publishing, so Publish alone commits.
  - Publish left the ⋯ menu.
- **Not built:**
  - Figma's "Watch 2-min tutorial" (no video yet; the panel links to the guide).
  - "Edited" status and "Previewing" in the switcher.
  - An "Add section /" shortcut.
