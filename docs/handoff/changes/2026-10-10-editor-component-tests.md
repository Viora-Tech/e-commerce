# Editor component tests (H3)

Branch `test/editor-component-tests`. First Testing Library tests in the admin.

- Admin devDependencies: `@testing-library/react`, `@testing-library/dom`,
  `@testing-library/user-event`, `jsdom` (all MIT).
- `apps/admin/vitest.config.ts` also picks up `src/**/*.test.tsx` and runs `test/dom.ts` (jsdom
  stubs + cleanup; a no-op for Node tests). Component files opt in with
  `// @vitest-environment jsdom`.
- Tests (47, in `apps/admin/src/components/themes/customize/`):
  - `template-list.test.tsx`: groups, Default vs alternates, used-by counts, pick, create per
    kind, search and empty state, the ⋯ menu (duplicate / rename) not picking the row.
  - `template-picker.test.tsx`: `templateLabel`, trigger label, refresh on open, close after pick,
    create, spinner while loading.
  - `section-tree-item.test.tsx`: select (setUi + canvas scroll), custom name, blocks toggle,
    hide via replace keeping the id, add/remove blocks, inline rename (Enter / Escape), more
    menu (duplicate, save as my section, remove), locked rows, Move out for nested blocks.
  - `link-picker.test.tsx`: empty/chip/URL display, clear, home pick + recent, search all kinds,
    drill into a kind and back, empty and failed states, typed URL, unsafe paste refused,
    new-tab switch, read-only.
  - `add-section-browser.test.tsx`: click and keyboard add with clamped index, search by name or
    description, header group restrictions, Apps tab by app, My sections copy (new id) + toast,
    empty state.
  - `section-inspector.test.tsx`: theme settings when nothing selected, custom name, Basic /
    Advanced tabs (passed to the fields via context), no-fields state, remove at its location,
    no remove for main sections, deselect.
- Ran only these six files once: 47 passed. No suite run.
- Docs: developer docs Operations → Testing → "Admin component tests".
