# Page passes 8 and 11: Discounts and Content

Audit section 7, rows 8 (`/discounts`, `/discounts/[id]`, `/discounts/new`) and 11
(`/content/*`: hub, blog posts, blogs, files, menus, redirects, content types and entries).
Visual and state consistency only: every discount rule, amount and content save is as before.

## Already in place (checked, left alone)

- No popovers left in Content: the metaobject reference search and the menu destination picker
  are on RecordCombobox since wave 2, so the "popover duplicates" item had nothing left to merge.
- The media-pick dialog is on the dialog shell at the `wide` size (56rem, was a raw 64rem
  dialog), with room for the X; its width needed no change.
- Every Content dialog is on the shell with `busy`; the shells (ProoflyListPage /
  ProoflyDetailPage) and PageHeader were already used everywhere except the file page.

## Discounts

- List: a failed read (tab, search, filter, page, or the re-read after a row or bulk action)
  shows "Could not load discounts" with Try again in the table, instead of the old rows.
- List skeleton: the real title and Create button, four tiles, and the real ResourceTable in
  its loading state with the discount columns (was the generic table).
- Discount page: Pause/Resume and Duplicate spin on their own button (were dim only); Delete
  waits while another action runs. Skeletons: 3 header buttons and 4 cards (edit), 1 and 3 (new).
- Summary card: grey caption labels over body values, like the Usage card (labels were the same
  colour as values). Same sentences.
- Applies-to picker (and every PickedField): while picked rows are read it shows placeholder
  rows; when the read fails it shows "Something went wrong" with Try again (was an empty field
  that looked like nothing was picked). The "nothing picked" line is grey.

## Content

- Hub: its own skeleton (title and the four cards), instead of a list table.
- Blog posts: failed reads in the table with Try again ("Could not load blog posts"), also after
  a row or bulk action; list skeleton with the real columns. Post page: the first card is a
  DataCard titled "Post"; Delete spins. Blogs: the list is a DataCard titled "Blogs" with a count.
  Skeletons match (4 side cards on the post page, one card on Blogs).
- Files: a failed read shows "Could not load files" with Try again inside the library card; the
  empty library is EmptyState `page` with the dropzone as its action; tiles, preview and
  dropzone use the card radius (`rounded-lg`, was `rounded-xl`). The file page is on
  ProoflyDetailPage. New Files skeleton (toolbar and tile grid); the file page skeleton has
  its 5 buttons, 2 main and 3 side cards.
- Media-pick dialog (shared, every image field): a failed read shows Try again instead of
  "No files match"; a failed next page keeps the files and offers Try again; the empty line is
  EmptyState.
- Menus: the row ⋯ menu is RowMenu (the table preset, as blog posts use); list skeleton with
  the real columns. Menu editor: the items card is a DataCard (flush, the link warning strip
  under the title); "No items" is EmptyState. Skeleton: 1 main and 2 side cards.
- Redirects: row ⋯ is RowMenu; Export spins; a failed read shows "Could not load redirects"
  in the table (was a toast over old rows); skeleton with the back link and real columns.
- Content types: empty is EmptyState `page`; skeleton with the real columns. Entries: failed
  reads in the table ("Could not load entries"), empties are EmptyState `page`, bulk Delete
  spins, skeleton with the real columns. Entry, definition and template forms: their raw cards
  are DataCards ("Fields", "Details", the name step with its buttons in the card footer). New
  `loading.tsx` for the entry, new entry, definition and blank-definition pages.
- Extra fields card (MetafieldsCard, shared): a DataCard; a failed read shows Try again instead
  of "no extra fields", which read as if none were defined.
- Column specs moved to their own files so the skeletons share them: `menu-columns.tsx`,
  `redirect-columns.tsx`, `entry-columns.tsx`, `definition-columns.tsx` (same columns).

## Shared files touched

- `components/pickers/picked-field.tsx` (discounts, catalogs, payment rules, pre-orders,
  cart limit): loading rows and the failed state; nothing changes when the read works.
- `components/metaobjects/metafields-card.tsx` (product, variant, collection, customer, order,
  page, blog post, Settings → Custom data): Card → DataCard, failed state.
- `components/media/media-pick-dialog.tsx` and `media-tile.tsx` (every image field, product
  gallery): failure state, card radius. Product gallery tiles were already `rounded-lg`.

## Not done

- `/online-store/pages` belongs to the Online store pass (row 12).
- The hub cards keep their own tile markup (they are not DataCards: icon, facts and an Open
  button); the files grid keeps its own card (toolbar, grid and pager in one card, Figma 647:1251).
- The menus and redirects copy `actions.label` ("Menu actions", "Redirect actions") is no longer
  read; the row menus use the table's "More" label like every other list.
- The Files skeleton does not draw the folder bar (it only shows when folders exist).
