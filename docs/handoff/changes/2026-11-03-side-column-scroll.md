# Detail pages: the right column no longer scrolls on its own and clips its cards (#1057)

`StickySideColumn` (every detail page's right column: page columns, the order frame, Proofly
frames) capped itself at the screen's height and scrolled internally with a hidden scrollbar.
A column slightly taller than the screen (inbound shipment: 848px of cards in an 821px cap)
scrolled on its own when the pointer was over it, sliding cards up under its top edge and
cutting off the last card ("cuts into the page").

Now it is sticky only when its cards fit the scroll area with 1.5rem above and below (measured
with a ResizeObserver on the column and the admin's `main`); otherwise it scrolls with the page.
No inner scroll, nothing clipped. Cards keep their full height (`*:shrink-0`, #671).
Not changed: the settings menu, checkout branding preview and create-shipment summary keep their
own sticky lists.
