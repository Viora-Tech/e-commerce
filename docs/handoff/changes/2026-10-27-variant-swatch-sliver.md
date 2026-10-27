# Variant colour swatches showed as 2px slivers

On Waimers product pages the colour chips were thin lines: the imported theme's own `.variant-picker__pill` (padding 0 16px, height 40px) loads after `section-product.css` and beat `.variant-picker__swatch { padding: 0 }`, leaving 2px for the photo. The swatch rule is now `.variant-picker__pill.variant-picker__swatch`, so a theme's pill style cannot squeeze it.
