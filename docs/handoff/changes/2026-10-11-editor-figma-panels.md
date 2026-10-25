# Theme editor: panels and inspector matched to Figma (2026-10-11)

Second PR for the owner's "still far from Figma" complaint about Customize. It checked the builder
frames in Figma section 337:18268 side by side with screenshots of a duplicated theme, at 1920×1080
in light and dark.

- **Inspector** (Figma 381:6210):
  - 340px wide, scrolling as one column.
  - Header: the section's name in 16px with a trash button. No icon tile, breadcrumb or ✕ any more; Esc deselects.
  - Basic | Advanced as a 32px muted switch, with a 12px hint.
  - Basic fields sit in a bordered **Content** card. On Advanced, each settings group is its own card, under the breadcrumb.
  - Labels are 13px in the foreground colour. Text boxes are 40px with a 10px radius; selects and numbers are 36px.
- **Left panel heads** (`panel-title.tsx`):
  - Add and Layers keep the store line.
  - Layers has an **Add** button.
  - Pages has **New page**.
  - Media, Theme settings and Store settings open on a 16px title.
  - AI is "Build with AI", with **New chat**.
  - Rail labels: "Layers" and "Build with AI".
- **Layers groups** (Figma 392:5543): "Header group" and "Footer group" with an "On every page" chip, and "Template: <page>", in 12px semibold. The counts are gone.
- **Pages**: 40px search, uppercase PAGES / TEMPLATES labels, 35px rows with a page glyph and "Default". The open row is tinted instead of ticked.
- **Media**: drop zone (drop or click; several files), full-width search, tiles with file names and Used / Unused (on this page), and a hint at the foot.
- **AI idle**: the question, suggestion cards with a spark, and the prompt box at the foot.
- **Fix**: the full-view keys (`\`, Ctrl/⌘ + `.`, Esc) now also work while focus is in the canvas. The frame's listener is attached again after the frame loads.
- **Not built, listed per frame in the PR**:
  - the Page settings form;
  - Theme settings' Figma layout;
  - the flat Layers list with lock and eye;
  - the Media type filter;
  - per-page Edited / Default status;
  - AI thinking, plan, preview and applied states;
  - inspect mode, shortcuts dialog, language/market preview, code block.
  - Page settings and Theme settings are the next PR.
