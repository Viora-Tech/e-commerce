# Admin lists keep their columns apart on narrow screens (#895)

On a phone (or a narrow window) the Orders list squeezed its 8 columns into the table's fixed
40rem minimum, so dates, totals and pills ran into each other. `ResourceTable`
(`apps/admin/src/components/table/resource-table/index.tsx`) now sets the grid's minimum width
from the visible columns, about 8rem each and never below 40rem (`--table-min-width`), so a
narrow screen scrolls the list sideways instead. Hiding columns (Columns menu) narrows it again.
Every list built on `ResourceTable` gets this. Checked in the local admin on Orders.
