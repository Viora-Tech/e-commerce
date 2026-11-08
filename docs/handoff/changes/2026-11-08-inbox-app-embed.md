# Inbox chat in the theme editor's App embeds panel

`INBOX_WIDGET_FIELDS` / `InboxWidgetSchema` (core `inbox/widget.ts`) were written for the theme
editor's App embeds panel, but nothing in the admin used them and `APP_BLOCK_SOURCES` only gives
Reviews an embed, so the chat never showed there.

- `AppsPanel` lists "Online store chat" (Inbox) first when the Inbox app is installed, and only
  then. Search matches it too.
- `InboxEmbedCard` (new): the on/off switch, greeting message, and every widget field (featured
  products with the product picker, colours, invert activator colours, icon, label, horizontal and
  vertical position, inherit font, activator font size, border radius), drawn by
  `InboxEmbedField` with the editor's own controls. A live picture of the chat button and
  greeting (`InboxEmbedPreview`) redraws on every change; the editor canvas does not draw app
  embeds. "Manage app" opens Sales channels → Inbox → Settings.
- These are the Inbox app's own settings, not theme settings, so they save as they change
  (`inbox.settings.save`, 600 ms after the last edit) with a Saving / Saved line, not with the
  theme's Save. The card says so.
- Copy: `data/customize-inbox-embed.ts` + Hindi. Test: `apps-panel-inbox.test.tsx`.

Not done: the storefront still hides the chat inside the theme preview iframe (`layout.tsx`,
"never in a theme preview"), so the full-page preview does not show it.
