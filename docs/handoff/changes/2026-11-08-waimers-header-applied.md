# Waimers header applied to the live theme (8 Nov 2026)

The header file from #1276 didn't work as written: the theme's sticky rule pinned the bar at
top 0, and the first gap value matched the theme's own. The final version, which the owner
approved in preview, keeps the bar 24px below the top and squeezes it to about 785px wide while
scrolling, with the same height and logo. It is saved as drafts on Zero Drift:
`snippets/revamp-header-float.liquid` plus one render line in `layout/theme.liquid`. The owner
publishes it from Themes > Edit code. `docs/themes/waimers-revamp/header-float.css` matches it.
