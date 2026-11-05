# Admin charts load on demand

`recharts` was in the first JavaScript of 176 of the admin's 188 pages, because the assistant panel in the shared layout imported it. Pages with no chart paid for it too.

- Every chart component keeps its name, props and place. It is now a thin shell that holds the card and the chart's fixed height, and the part that imports `recharts` moved to a sibling `*-plot.tsx`, loaded with `next/dynamic` (`ssr: false`).
- No page or consumer changed. The shells are client components, so `dashboard-page` can stay a Server Component.
- `layout/chart-loading.tsx` is the skeleton that fills the frame while the chart's code arrives.
- New rule of thumb: never import a value from `recharts` or `@commerce/ui/shadcn/chart` outside a `*-plot.tsx` file. One stray import puts it back on every page. `type ChartConfig` is fine.
- Measured from two `next build`s of `apps/admin`, gzipped first JavaScript per page: about 112 KB less (Home 842 to 719 KB, Products 841 to 729 KB, Orders 912 to 800 KB). Pages with charts still fetch the chart code, just after the page is usable.
- Those builds ran with `withSentryConfig` switched off locally, because it fails on Windows paths. Both builds used the same setting. Not checked in a browser.
