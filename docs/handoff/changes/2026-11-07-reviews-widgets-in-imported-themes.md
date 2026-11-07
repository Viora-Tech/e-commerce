# Imported themes: review widgets keep their own layout

A theme's CSS sits outside any layer, so it beat our Tailwind classes inside the review widgets on Horizon: `.grid` split the reviews into 14 thin columns, `h3` made review titles 2rem and `img` stretched review photos across the card. Inside `.commerce-app-block` those properties now go back to Tailwind with `revert-layer`. The product reviews also get a gap below them, and the carousel heading is capped at 2rem.
