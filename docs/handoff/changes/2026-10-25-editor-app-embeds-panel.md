# Theme editor: App embeds panel replaces Media (2026-10-25)

- Rail: the Media button is now **App embeds** (puzzle icon). `media-panel.tsx` is gone; the media library stays one click away in every picture setting (image picker), and dropping a picture on the canvas still works (`customize-media-drop.ts`).
- `components/themes/customize/apps-panel.tsx`: every embed the store's installed apps offer — search, a switch per embed, and its settings opening under it (Puck `AutoField`). Writes `theme.appEmbeds`, saved with the other theme settings on Save.
- `lib/customize-app-embeds.ts`: the installed apps' embeds from the client-safe `commerce.blocks.config.ts` (`AppBlockSource.embeds`, new).
- Copy: `customizeContent.appEmbeds` (+ Hindi `data/hi/customize-app-embeds.ts`); `rail.apps` / `panels.apps` replace `media`.
- Sweeps: `AppEmbedStateSchema` no longer exported (orphan), header on `app-embeds.test.ts` (both from #743).

No app ships an embed yet, so the panel shows its empty state. Next: Inbox's chat widget becomes the first embed (its `InboxWidgetSchema` / `INBOX_WIDGET_FIELDS` from #745), and the editor preview draws enabled embeds.
