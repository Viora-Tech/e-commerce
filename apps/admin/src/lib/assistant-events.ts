/**
 * The AI assistant lives once in the admin frame (AssistantHost); anything that wants to open
 * it (Home's suggestions, a page's "Ask AI" link) fires this event, optionally with a message
 * to send straight away. Browser only.
 */
export const OPEN_ASSISTANT_EVENT = 'admin:open-assistant'

export type OpenAssistantDetail = { prompt?: string }

export function openAssistant(prompt?: string) {
  window.dispatchEvent(
    new CustomEvent<OpenAssistantDetail>(OPEN_ASSISTANT_EVENT, {
      detail: prompt ? { prompt } : {},
    }),
  )
}

/** The shortcut's modifier as the keyboard prints it: ⌘ on a Mac, Ctrl elsewhere. Browser only. */
export function modKey(): string {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)
    ? '⌘'
    : 'Ctrl'
}

/** ⌘J / Ctrl+J: the AI shortcut (⌘K is search). Same key opens and closes it, with no animation. */
export function isAssistantShortcut(e: KeyboardEvent): boolean {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'j'
}
