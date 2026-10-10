# Figma-style section settings controls (B2)

Branch `feat/builder-settings-controls` (on top of #370). No migration.

The Section settings groups in Customize (Advanced tab) now use the Figma inspector controls
(369:5112 / 369:5133 / 369:5142) instead of plain dropdowns and six number boxes:
- `settings-segmented.tsx`: content width, alignment, corner radius and shadow as segmented
  switches (radio group, arrow keys move the choice).
- `spacing-field.tsx`: padding per screen size behind a desktop / tablet / mobile switch, top and
  bottom for the chosen screen.
- `scheme-chips.tsx`: the colour scheme as swatch chips named and coloured from the theme.
- `background-field.tsx`: "Colour | Image". Colour offers None, Text, Brand, Background, White
  and Custom; the theme colours are stored by name (`SECTION_BACKGROUND_TOKENS`,
  `sectionBackground` in section-settings.ts) so they follow the colour scheme and dark mode.
  Image is the image picker with its overlay.
- `settings-group-body.tsx` picks the control per setting; anything else, and the element style
  panel, stays Puck's own field. Chip styles are shared in `customize-field-styles.ts`.
- "Full width" content width is labelled "Full" so the four choices fit the panel.
