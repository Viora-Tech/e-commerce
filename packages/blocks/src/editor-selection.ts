import { createContext } from 'react'

/**
 * SOURCE OF TRUTH: EditorSelectionContext — WHAT the Puck id of the section selected in the
 * theme editor's sidebar / WHY sections that float over the page on the store (popups, the
 * cookie banner) open in the canvas only while selected (components/editor-overlay.tsx), and
 * reading Puck's own store from a block throws outside <Puck> (unit tests, previews).
 * WHERE: the admin's Customize preview frame provides it; everywhere else it is null, so those
 * sections show their slim stand-in strip.
 */
export const EditorSelectionContext = createContext<string | null>(null)
