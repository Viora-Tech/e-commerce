# Calendar range edges (#1460)

`packages/ui/src/components/shadcn/calendar.tsx`:
- The focused day cell sits above its neighbours (`data-[focused=true]:z-20`), so its focus ring is
  not covered by the next day.
- `today` drops its rounding only in the middle of a range
  (`:not(:has([data-range-start=true])):not(:has([data-range-end=true]))`), so a range that ends
  or starts today keeps its rounded end. (A class selector with `_` does not work in a Tailwind
  arbitrary variant: `_` compiles to a space.)
Verified in the local admin: range end 10px radius, middle days 0, ring visible.
