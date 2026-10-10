# Gaps polish after browser check

Branch `fix/gaps-a-polish`. Headless Chrome check of discount detail (pause, resume, duplicate, delete on a test discount), abandoned checkout detail, Files, Files > Storage and Apps home, light and dark.

- Abandoned checkout reference now uses the end of the cart id (ids start with a timestamp, so every ref began the same).
- Storage "Largest files" name column no longer squeezed.
- Known and left: the usage cards sit above the provider settings header on Files > Storage; the discount page keeps its existing Type/Value layout rather than the Figma Method layout, and has no "in sales" line (no sales figure on discounts).
