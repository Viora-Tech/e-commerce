import { type InboxWidget, inboxFromApps, parseInboxSettings } from '@commerce/core/inbox'

/**
 * The chat button's look when the Inbox app is installed and its chat is on, read from the
 * `store.apps` value the layout already holds (no query). Null hides the chat. The same for
 * every visitor, so cached pages stay shareable; who is chatting is read when it opens.
 */
export function inboxLauncherOf(apps: unknown): InboxWidget | null {
  const { installed, raw } = inboxFromApps(apps)
  if (!installed) return null
  const { widget } = parseInboxSettings(raw)
  return widget.enabled ? widget : null
}
