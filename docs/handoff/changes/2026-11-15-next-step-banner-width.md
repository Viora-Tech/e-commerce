# Next step banner fills its card again

Since design wave 3 the order/return Next step banner is drawn with the shared `Alert`. `Alert`'s base
classes include `items-start`; with the banner's `flex flex-col` override that kept the inner row at its
content width, so the actions (Fulfil items, Create shipment) sat mid-card instead of at the right edge.
`next-step-banner.tsx` now adds `items-stretch`.
