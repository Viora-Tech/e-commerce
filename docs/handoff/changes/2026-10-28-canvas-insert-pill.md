# Customize: "+ Add section here" pill styled on imported themes

Fixes #908. On imported themes the store's unlayered `button` CSS stripped the canvas insert
pill (no accent background, dark 16px text), so it read as loose text instead of a centred
"+" pill. `canvas-insert-line.tsx` now marks the pill's box, colour and type classes `!`,
the same fix as the block toolbar (#906).
