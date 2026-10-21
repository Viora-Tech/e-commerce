# Themes: the account pages and the sign-in page are theme templates

Branch `feat/account-templates`. **Migration `0144_theme_template_account_kinds`** (widens the
`theme_template_kind` check; journal `when` is after 0143).

- New template kinds `account` and `login` (`TEMPLATE_KINDS`, `THEME_TEMPLATE_KINDS`), with main
  sections `MainAccount` and `MainLogin` (`MAIN_SECTION`; dynamic sections in
  `packages/blocks/src/sections/dynamic.tsx`). Their default template is just the main section.
- Storefront: `account/(signed-in)/layout.tsx` renders the `account` template; `MainAccount` is
  the old chrome (account nav beside the page), so every signed-in page (orders, order, return,
  addresses, profile, privacy) shares it. `account/login/page.tsx` renders the `login` template;
  `MainLogin` is the sign-in form. The page frame (`page-width py-10 md:py-14`) moved from
  `account/layout.tsx` into `components/account/account-frame.tsx`, drawn inside the main
  sections (and by the deleted and magic-link pages), so sections a merchant adds sit outside it.
  With no template row the DOM is the same as before.
- Admin: the kinds show in the editor's page picker ("Customer account", "Sign in"; icons
  `UserCircle`, `Lock`) with a canvas placeholder for the main section, like cart and search. The
  `customize.templates.names` copy has no Hindi overlay yet (none of its names do).
- Edit code lists them as `templates/account.json` and `templates/login.json`.

## Left to do

- **Password page** (`apps/storefront/src/app/-p/[storeId]`): a separate document the proxy
  serves for a locked store. It always paints the live theme, has no theme preview gate, and has
  no header or footer, while Customize's canvas always draws the header and footer groups. Making
  it a template needs those decided first.
- **Gift card page**: the storefront has no gift card page yet (only the checkout field), so there
  is no current UI to wrap. Build the page first (balance and code for a `/gift_cards/<code>`
  link), then add a `gift_card` kind the same way.
- Imported (Liquid) themes still map `customers/account` to `not_found` in
  `liquid-theme.ts#templateKeyFor`. Left as is.
