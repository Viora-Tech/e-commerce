# Thin admin scrollbars (#892)

Menus and panels in the admin (e.g. Orders → a row's ⋯ menu) showed Chrome's thick default
scrollbar with arrow buttons. `apps/admin/src/app/globals.css` set the standard
`scrollbar-color` with `scrollbar-width: auto`; since Chrome 121 that makes Chrome ignore the
`::-webkit-scrollbar` rules, so the full default bar was drawn.

Now `scrollbar-width: thin` with the theme's thumb colour (`--scrollbar-thumb`) and a
transparent track, so Chrome and Firefox draw a slim bar with no arrows. The WebKit rules stay
for Safari (6px, rounded, no buttons) and no longer hide the thumb until hover, so Safari and
Chrome behave the same. Checked in the local admin on Orders' row menu.
