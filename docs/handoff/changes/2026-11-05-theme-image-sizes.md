# Imported themes use the sized image copies

`image_url: width: N` on an imported Liquid theme returned the original file, so every srcset entry was the same image. Waimers served a 1.8 MB PNG where a 10 KB WebP already sat on the CDN.

- `ImageDrop` now keeps the media row's variants privately (never printed by `| json`) and `image_url` picks the smallest WebP at least that wide.
- Past the largest copy the original is used, unless the original is no bigger.
- `image_tag` writes a `srcset` only when the theme gives `sizes`.
- Variants now load for product, variant, collection and article images, and for image_picker settings saved as objects. An image_picker saved as a plain URL string still serves the original.
- Liquid product data may be cached: an old entry has no variants and serves the original until it refreshes.
