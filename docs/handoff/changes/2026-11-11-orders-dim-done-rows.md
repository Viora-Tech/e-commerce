# Orders list: done rows clearly faded (#1446)

`ResourceTable`'s `rowMuted` rows (Orders: shipped, in transit, delivered, cancelled, archived via
`orderRowDone`) now draw their cells at 40% opacity in greyscale, back to 80% on hover, instead
of 60% on a muted background that read as a highlight in dark mode. Which rows dim is unchanged.
