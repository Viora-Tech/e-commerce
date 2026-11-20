# Theme editor gaps from the 17 Nov Shopify study (branch feat/theme-editor-gaps)

Three gaps for imported Shopify (Liquid) themes in Customize, closed:

1. **Theme scripts.** The editing canvas still never runs theme JS (it is an iframe on the admin's
   origin; running a merchant theme's code there would give it the admin session). Instead the
   canvas has a **Theme scripts** pill (bottom right; home page and default product template). On,
   it shows the store page itself in a frame (`?theme-preview=<token>&theme-design-mode=1`). The
   proxy sets `x-theme-design-mode` only for a valid preview inside a frame; the shim sets
   `Shopify.designMode = true`; `LiquidDesignMode` takes the editor's sections and selection over
   postMessage (admin origin only), re-renders changed sections via POST
   `/theme-actions/editor-sections` (preview token required, design mode, never cached), re-runs
   their inline scripts with the page nonce, and fires `shopify:section:load/unload/reorder/
   select/deselect` and `shopify:block:select/deselect`. A click on a section selects it in
   Customize. Not yet: unsaved Theme settings (they show after Save), collection/page templates
   and alternates (the pill hides there).
2. **App blocks.** Shopify app blocks were kept in the data but read their URL as `block.type`,
   so `{% when '@app' %}{% render block %}` fell to `else`. They now read `@app` (own type under
   `commerce_app_type`); `{% render block %}` on one draws our widget's slot (Judge.me, Loox,
   Yotpo, Okendo, Stamped review widgets → our Reviews widget) or, in design mode only, an
   "App block: <name> (not available)" box the canvas labels in the merchant's language. The
   storefront prints nothing for those. Block types up to 300 characters pass the placement schema
   (long app URLs failed the section's canvas render). Layers names app blocks by their app.
   The Apps panel lists the theme's own Shopify app embeds (`current.blocks`) read-only.
3. **Apps on the canvas.** `CanvasAppEmbeds` draws every app embed that is on (the Reviews
   floating tab, later embeds through the same registry) with the store's data, like
   `CanvasInboxLauncher` does for chat. Chatwoot is not drawn (its script is third-party).

No theme data, settings or posters were changed on any store. Tests: core `app-blocks.test.ts`,
`imported-app-embeds.test.ts`; storefront `liquid-design-mode.test.ts`, `liquid-shim.test.ts`;
admin `canvas-app-embeds.test.tsx`, `liquid-design-frame.test.ts`.
