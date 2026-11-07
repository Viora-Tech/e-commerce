# Imported themes: a check that Customize matches the storefront

`customize-parity.test.ts` draws one saved section down both routes and fails if they differ, apart from the scripts and handlers the canvas removes on purpose. It also checks that every stylesheet in the theme's head survives the sanitiser.

Its small test theme holds the cases that told the routes apart so far: a static block turned off, nested blocks and a `<` in a CSS comment. Add to that theme when a new difference turns up. It does not cover real themes yet, or what a theme does differently in design mode.
