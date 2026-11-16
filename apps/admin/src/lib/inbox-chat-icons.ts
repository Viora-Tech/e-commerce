import type { InboxWidget } from '@commerce/core/inbox'

/** The chat icon paths, as the storefront button draws them (`chat-icon.tsx`). */
export const INBOX_ICON_PATHS: Record<Exclude<InboxWidget['activatorIcon'], 'none'>, string[]> = {
  chat: ['M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z'],
  bubble: [
    'M14 9a5 5 0 0 1-7.3 4.4L3 14.5l.9-3.4A5 5 0 1 1 14 9Z',
    'M10.5 17.8a5 5 0 0 0 6.8 1.6l3.7 1.1-.9-3.4a5 5 0 0 0-3.6-7.4',
  ],
  help: [
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
    'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6',
    'M12 17h.01',
  ],
}

/** How high the button sits above the window's bottom edge (storefront `LAUNCHER_BOTTOM`). */
export const INBOX_LAUNCHER_BOTTOM: Record<InboxWidget['vertical'], string> = {
  lowest: '1rem',
  higher: '5.5rem',
  highest: '10rem',
}
