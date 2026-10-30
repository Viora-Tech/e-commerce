# Collections: move to position (30 Oct 2026, audit #67)

Dragging only reorders within one page of rows, so a product at #60 could not reach the top. In a
manual collection each row now shows its place in the whole collection (1, 2, 3…); clicking it
opens "Move <product>" with a position field (1 first, N last). `moveToPosition` in
`components/collections/form-state.ts` (tested); the change is part of the unsaved form, saved
with the collection's Save. Also: the market page and dialog helpers moved above render logic
(component checker).
