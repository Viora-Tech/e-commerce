/** Copy for page edits the AI chat drafts in the theme editor (Customize → AI tab). Plain words. */

export const customizeAiContent = {
  card: {
    title: 'Page edit',
    apply: 'Apply',
    dismiss: 'Dismiss',
    /** Before Apply, on a theme that is not live. */
    draftNote:
      'Applying changes this page in the editor. Shoppers see it only once you publish this theme.',
    /** Before Apply, on the live theme. */
    liveNote: 'This theme is live: the change shows on your store after you save.',
    applied: 'Applied — not live until you publish',
    appliedLive: 'Applied — this theme is live, so it shows on your store after you save',
    undo: 'Undo in the editor takes it back.',
    dismissed: 'Dismissed',
    flagged:
      'Some page text looked like instructions to the AI and was ignored. Check this change before you apply it.',
    gone: 'Those sections or blocks are no longer on this page. Ask again.',
    partly: (n: number) =>
      n === 1
        ? '1 change was skipped: its section or block is no longer on the page.'
        : `${n} changes were skipped: their sections or blocks are no longer on the page.`,
    empty: '(empty)',
    on: 'On',
    off: 'Off',
    where: (section: string, block: string | null) => (block ? `${section} › ${block}` : section),
  },
}
