# Product gallery: photos are never stretched past their own size

The owner saw product photos look sharper on the old Shopify store. Same files (480 x 480, the
Shopify `_large` copies), but Shopify showed them at about 460 px while our stage stretched them
to about 675 px (4:3 stage, `object-fit: contain`), which is what made them soft.

- `product-gallery.tsx` sets `--photo-width: <media width>px` on each stage photo
  (`photoWidthStyle`); `.product-gallery__zoom img` caps `max-width` at it and centres it.
  Media without a width (legacy rows) keep filling the stage as before.
- Large photos (wider than the stage) are unchanged.
- The real fix for the 53 small-photo products is still larger originals (photo refresh list).
