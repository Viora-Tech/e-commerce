# Build your own sections

**Build your own sections** (27 September 2026, `feat/custom-sections`, stacks on
`feat/editor-modern-look`, no migration): Puck slots. Layout blocks `Group`, `Columns`,
`Grid`, `Tabs`, `Accordion`, `Carousel` hold any block, nestable; elements `Heading`, `Text`,
`Image`, `Button`, `Icon`, `VideoPlayer`, `Spacer`, `Divider`, `Badge`, `ProductCard`,
`CustomHtml`; every one has a `style` panel (spacing, size, text, colour tokens or custom,
corners, shadow, visibility per breakpoint). Storefront draws slots on the server
(`renderBlock` in `@commerce/blocks/slots`). Custom HTML goes through `sanitize-html` (MIT)
with a strict allow-list, iframes only from YouTube/Vimeo/Instagram and sandboxed, on draft
save, on render and in the editor. Tree shows nesting (indent guides, collapse), reorder per
slot, "Move out of", "Save as my section"; Add panel has a **My sections** tab (store-level,
`store.preferences.customSections`, 40 sections / 1 MB, copies get new ids). Hotkeys:
Cmd/Ctrl+C/V/D, Alt+Up/Down, Delete, for nested blocks too. Docs: developer docs "Slots and
custom sections", merchant guide "Build your own section". DB-backed tests for the service
and the preferences merge were not written or run in the cloud session (no Postgres there).
