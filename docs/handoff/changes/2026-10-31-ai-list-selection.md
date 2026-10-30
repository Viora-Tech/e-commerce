# AI assistant acts on the ticked list rows (#983)

- Before: on Products, ticking rows and asking the assistant "raise these by ₹500" sent only the page kind. The model guessed from the chat history and picked a product it had changed earlier.
- Now: `ResourceTable` publishes its ticked row ids (`apps/admin/src/lib/list-selection.ts`, keyed by path), and the assistant host sends them as `page.selectedIds` (at most `ASSISTANT_MAX_SELECTED` = 100).
- The server reads the rows under RLS (`page-context.ts` `selectionLine`) and names them in the prompt: products and collections by title and handle, orders by number, customers counted only. It tells the model that "these" means exactly the ticked rows.
- Test it: tick 2 products, ask "increase price by 500"; the proposal must name those 2 only. Untick, tick 2 others, ask again.
