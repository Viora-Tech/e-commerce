# System pages: centred and spaced on imported themes

Seen on Waimers (15 Nov): `/unsubscribe/<token>` on the imported theme "Zero Drift" drew its card
stuck to the top-left edge right under the header, with no space above and nothing centred.

**Root cause.** It was not missing CSS. The storefront stylesheet (Tailwind and the blocks CSS)
loads on imported-theme pages: `flex`, `w-[...]`, `p-6`, `bg-surface` all applied. Only the
margins were lost. Tailwind v4 puts every utility in `@layer utilities`, and an unlayered rule beats
a layered one whatever its specificity. The page carries two unlayered `* { margin: 0 }` resets: the
imported theme's `base.css` and our own blocks `base.css` (packages/blocks/src/styles/base.css). So
`mx-auto my-16 md:my-24` computed to `margin: 0`. Checked on www.waimers.in with Playwright, which
listed the matching rules and their layers. The blocks reset also zeroes these margins on our own
themes, so every storefront margin utility without `!` is dead on every theme. The existing
`mx-auto!` in sign-in and checkout, and the padding wrapper on the COD page, worked around the same
problem.

**Pages affected** (margins zeroed, checked live): email unsubscribe, newsletter confirm, review
emails unsubscribe (card stuck top-left); account deleted (text and button not centred, button
full width); policy pages (no space between the title and "Last updated"); the page template's
main section (`mb-6` under the title). Not affected: COD confirm (already padding-based), track
order, affiliate, wishlist, collections list, sign-in/register/magic link (`mx-auto!`), 404 (theme
template), checkout pages (own shell).

**Fix.**
- New `components/system/system-panel.tsx`: `page-width flex justify-center py-16 md:py-24` around
  a `max-w-[28rem]` card in the theme's surface colour, centred by flex and spaced by padding,
  which no reset touches. The corner radius falls back to the imported theme's `--radius-m` when
  `--radius-card` (set only by our theme settings) is missing. Used by unsubscribe, newsletter
  confirm, review emails and COD confirm (which drops its local copy).
- Account deleted, policy page and main page: spacing by `gap`/padding and flex centring; the dead
  `mx-auto max-w-3xl` (also beaten by `.page-width`'s unlayered `max-width`) removed, so nothing
  changes there except the spacing that was meant to be there.
- New ratchet sweep `storefront-margins` (docs/guardrails.md, ad): a new margin utility without `!`
  in the storefront fails. 39 existing files are listed with a count; their margins are dead today
  and the screens were reviewed that way.

**Left.** The listed files (checkout pieces, account lists, affiliate, browse, search, cookie
banner) still carry dead margins; fix each when its screen is next touched. Moving the blocks reset
into `@layer base` would revive margins on our own themes but not on imported ones, and changes
many reviewed screens at once, so it was not done here.
