# Imported themes: Customize and the storefront now draw the same thing

Three separate causes made an imported theme look different in Customize, on Horizon themes such as Claw Gears:

- `themes.import.render` had its own hand-written block shape with no `static` and no nested blocks, so the canvas lost both. A static block the merchant had turned off (Claw Gears' header menu) came back with the theme's defaults. The shape now lives once in `fields.ts`, beside the type.
- `canvas-sanitize` drops a `<style>` holding `<`, and Horizon's colour comment says "iOS < 16.4". The canvas lost every colour scheme, so the header was grey. CSS comments are removed first.
- Our `.header` rule also hit Horizon's `<header-component class="header">`, adding 2rem of height to its header on the storefront.
