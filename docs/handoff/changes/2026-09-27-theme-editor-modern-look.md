# Theme editor modern look

**Theme editor modern look** (27 September 2026, `feat/editor-modern-look`, no migration):
restyle of the Customize chrome only (layout and behaviour unchanged). One icon family
(Phosphor regular, `editorGlyphs` in `packages/ui/src/icons.tsx`, 16px sidebar / 14px
inline), section glyphs on small tiles tinted per kind (layout, text, media, product, app;
`lib/customize-section-kinds.ts`), 13/12/11px type scale with sentence-case group headings,
32px rows, 8px row / 12px panel radii, `bg-muted/60` hover, selected = accent wash plus a
2px accent bar, visible focus rings, motion capped at 200 ms. Scale lives in
`lib/customize-chrome.ts`. Font stays Satoshi; Inter or Geist for the chrome is offered as a
follow-up for the owner to decide.
