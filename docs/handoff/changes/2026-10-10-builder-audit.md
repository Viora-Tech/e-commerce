# Customize: Audit tab and inspector breadcrumb (A3)

Branch `feat/builder-audit`. No migration.

- Sections panel: "Sections | Audit" switch (`sections-panel.tsx`) with the issue count on Audit.
- `lib/customize-audit.ts` (`auditTemplate`, test `customize-audit.test.ts`): pictures with no
  description, buttons with words but no link, sections hidden on phones and computers (section
  settings or an element's style visibility), emptied headings (Heading element, or a section
  whose default heading was cleared), and theme colour pairs below AA. Eye-hidden blocks are
  skipped. One row per block and kind, with a count.
- `audit-panel.tsx`: each row selects its block and scrolls it into view; colour rows open Theme
  settings. Plain words, one fix hint per kind (copy in `data/customize.ts` `audit`).
- Inspector header: `inspector-breadcrumb.tsx` replaces the "In <container>" line with
  "Template › Group › Image banner"; containers are buttons that select them.
- `eachBlock` is exported from `lib/customize-slots.ts` for the audit.
