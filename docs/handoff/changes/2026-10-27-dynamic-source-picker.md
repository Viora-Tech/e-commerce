# Dynamic source picker redesign (2026-10-27)

Theme editor › "Connect dynamic source" no longer lists every content entry as its own
heading ("Accessory size › L", "Accessory size › Large", … each with one "Label" row).

- `apps/admin/src/lib/dynamic-source-groups.ts` (pure, tested): groups the catalog into one
  section per source type — Product (fields + extra fields), Collection, Store, then each
  content type — with entries as rows inside a content type. Search filters by section,
  entry or field name; `splitMatch` marks matches; `startsOpen` decides which sections start open.
- `dynamic-source-picker.tsx`: dialog styled like the image picker (header with search,
  scrolling body, muted footer). Folding sections, 36px rows, icon per type, match
  highlighting, empty and no-match states, ↑/↓/Home/End/Enter from the search box
  (combobox + `aria-activedescendant`).
- `dynamic-source-picker-group.tsx`: one section; a content entry with one field is a single
  row ("L · Label"), with several fields it shows the fields as chips.
- Copy moved to `dynamicSourcePickerContent` in `data/dynamic-sources.ts`, with a Hindi
  overlay `data/hi/dynamic-sources.ts`.
- What gets inserted on pick (the source path) is unchanged.
