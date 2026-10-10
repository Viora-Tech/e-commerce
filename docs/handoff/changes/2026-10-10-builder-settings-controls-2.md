# Section settings controls, second pass (B2b)

Branch `feat/builder-settings-controls-2`. No migration. Follows #374, closer to the Figma
inspector frames (369:129537–369:131510).

- Spacing (`spacing-field.tsx`) is the Figma spacing box: an "Editing" device switch, a box with
  the top and bottom padding around a "Section" block, each a number with − / + steppers (4px a
  press, Shift for 40px), and quick sizes None / S / M / L / XL (0 / 24 / 48 / 72 / 96) that set
  both sides for the chosen screen in one edit (`onPatch` through `SectionSettingsGroups`).
- Entrance animation (`animation-field.tsx`) is a select with a "Preview" label beside it that
  plays the chosen effect with the same poses as `section-reveal.tsx`; still under reduced motion.
- Background colour (`background-field.tsx`): the custom swatch is the browser's colour picker,
  and a "Current" line names the colour and its hex, as in Figma.
