# Theme version history: one design in the library and the editor

Branch `design/version-history-one-design`. The theme library's ⋯ → Version history and the
editor's (Figma 697:4526) were two different UIs. Both now open
`apps/admin/src/components/themes/theme-version-history.tsx` (the editor's design): "Now" first,
then each time the theme went live with an initials avatar, who and when; the newest of a live
theme is tagged Live; picking a row expands Preview + Restore. `theme-versions-dialog.tsx` and
`customize/editor-versions-panel.tsx` are deleted.

Choices:
- `where="editor" | "library"`. In the editor "Now" is the member editing. The library has no
  open editor, so "Now · Unsaved changes in Customize" (pencil avatar) shows only when the theme
  has drafts (`ThemeItem.hasDraft`), else no Now row.
- No confirm before Restore in either place (the editor's behaviour): restore only writes the
  drafts and nothing reaches shoppers until Publish. It does replace the current drafts of
  those pages, and unsaved drafts are not versioned, so the expanded row now says so
  ("Its pages replace the current draft…"). Restore closes the dialog in both; the library then
  refreshes so the theme shows "Unsaved changes".
- The library loses the old "3 pages" line and the "Theme published / Changes published" wording
  for the editor's "Published / Saved / Live" tags.

Copy: one `themesContent.versionHistory` (+ Hindi in `data/hi/themes.ts`); the old
`themesContent.versionsDialog` and `customizeContent.versions` (and its Hindi) are removed. The
editor's raw `text-xs` became `text-period`. Tests: `theme-version-history.test.tsx`.
