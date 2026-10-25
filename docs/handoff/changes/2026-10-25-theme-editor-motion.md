# Theme editor: switches and panels move instead of jumping

- "Sections | Audit" and "Basic | Advanced" use one `SegmentedTabs` with a highlight that slides under the active tab (transform, dropdown time, strong ease-out).
- Sections ↔ Audit content fades and settles 4px instead of swapping in one frame.
- Left and right panels close by narrowing to nothing (drawer curve, modal time) while their content fades and drifts toward the edge; `inert` replaces `hidden` so closed panels stay out of tab order.
- Reduced motion: no movement, instant panel changes.
