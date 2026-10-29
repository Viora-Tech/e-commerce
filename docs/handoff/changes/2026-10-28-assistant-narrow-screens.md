# AI assistant no longer squeezes the page on laptop widths (#903)

From `md` (768px) the assistant was a fixed 440px column pushing the page, so on a ~900px window
with the sidebar open the page shrank to ~190px (owner's screenshot: the Pre-order card one word
per line). Now (`components/assistant/assistant-host.tsx`, `assistant-panel.tsx`) the side
column is used only from 84rem (1344px), where a 440px column still leaves a readable page; below
that the panel is the sheet phones already use, sliding up over the page, centred and at most
40rem wide from `sm`. Checked in the local admin at 884px on a product page.
