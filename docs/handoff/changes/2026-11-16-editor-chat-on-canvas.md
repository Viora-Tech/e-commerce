# Theme editor: the Inbox chat button shows on the canvas

Owner report (16 Nov): changing App embeds → Online store chat → Position (left/right) showed
nothing on the editor canvas. The storefront leaves the chat out of theme previews on purpose
(`layout.tsx`: "never in a theme preview"), and the canvas draws only the theme's sections, so
the chat button was never on the canvas; only the small picture inside the panel moved.

- `lib/inbox-embed-store.ts`: one shared copy of the Inbox chat settings while Customize is open
  (`useSyncExternalStore`). The editor loads it when Inbox is installed (`useInboxEmbedFor`).
- `InboxEmbedCard` reads and edits that copy instead of its own state; saving to the app is
  unchanged (debounced `inbox.settings.save`).
- `CanvasInboxLauncher` (drawn by `PreviewFrame` inside the canvas frame): the chat button at
  the chosen corner and height, with the button colours, label and icon, as the storefront draws
  it. It moves as the settings change and disappears when the chat is switched off. A picture
  only (no clicks).
- `lib/inbox-chat-icons.ts`: the icon paths and launcher heights, shared by the panel picture
  and the canvas button.

Test: `apps-panel-inbox.test.tsx` checks the canvas button appears on the chosen side and goes
away when the switch is turned off.
