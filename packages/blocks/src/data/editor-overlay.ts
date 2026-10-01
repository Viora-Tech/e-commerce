/** Copy for the editor's stand-in strip for popups and banners (components/editor-overlay.tsx). */
export const editorOverlayContent = {
  hint: (when?: string) =>
    when
      ? `Hidden on the page. On the store it opens ${when}. Select it to preview.`
      : 'Hidden on the page. Select it to preview.',
} as const
