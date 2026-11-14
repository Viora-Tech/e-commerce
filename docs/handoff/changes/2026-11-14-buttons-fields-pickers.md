# Admin design audit wave 2: buttons, fields, pickers (steps 7, 8, 16)

Branch `design/buttons-fields-pickers`. Design audit section 6.2 steps 7, 8 and 16.

## Buttons (step 7)

- `kit/kit-button` is gone. Its 60 uses in 26 files (Sales channels, product AI writer and SEO,
  bulk write, billing plan card, reports home, assistant action card, MCP activity, AI activity,
  theme edit card, SEO fix cards) now use the shared `Button`:
  primary → default, secondary → `outline`, chip/pill → `outline size="sm"`,
  link → `link` (inline, `h-auto px-0`), linkSm → `link size="xs"`, `href` → `render={<Link />}`.
- Buttons that showed a busy state by hand (`busy ? <Spinner />`) now use `loading` (approve,
  cancel, undo on assistant cards; AI writer generate/regenerate; bulk write start/apply; SEO
  suggest; AI activity undo; Meta "Turn on"; MCP "Load older").
- `kit/kit-icon-button` is gone. Its 10 uses in 8 files (collection rules, condition rows, PO and
  transfer lines, landed cost, supplier contacts, inbound shipment orders, documents) are
  `Button variant="outline" size="icon"` with `aria-label` and `title` (2.25rem, like every other
  icon button; was 2.5rem).
- SaveBar Save and Discard use the shared button radius (no more `rounded-full` pills inside the
  pill bar).

## Fields (step 8)

- `kit/kit-field` is gone. The 13 product and variant sections use `Field` + `FieldLabel` +
  `FieldDescription` (`FieldError` for the product title), so product page labels match settings
  (0.75rem/500 ink-strong). Fields that sat side by side in a flex row keep `min-w-0 flex-1`.
- 18 raw field labels (label above a control) in 15 files are `FieldLabel` now: affiliate note,
  delivery preview PIN, GST invoice export date, inventory location/reason, media alt text,
  profit courier charge, preference text settings, sale start/end, accent colour, checkout
  text, default delivery cost, fee rate percent/fixed, new theme file name, custom CSS, social
  links. Labels next to a switch, checkbox or radio stay as they are.
- New `fields/search-field.tsx` (`SearchField`): InputGroup + search glyph + input, sizes
  `sm`/`default`/`lg`. It replaces `kit/kit-search` (deleted) and 18 hand-made icon + input
  pairs (automations pickers and run dialog, collection products, draft products, email
  products, media picker toolbar, order edit add search, resource pick dialog, add gateway,
  select products, variant toolbar, settings search, theme dynamic source, inbox
  conversations, platform filters, markets country picker, home metric picker).

## Pickers (step 16)

- New `pickers/record-combobox.tsx` (`RecordCombobox`): SearchField + rows, three list styles:
  `inline` (rows under the field), `panel` (always-there list box with a status line),
  `popover` (floating list while focused; Escape closes; optional Enter picks the first row).
  Callers keep their own search (debounce, minimum letters, API) so behaviour is unchanged.
- One customer picker: `customers/customer-picker.tsx` has `mode="list"` (merge customers,
  change an order's customer) and `mode="dropdown"` (issue gift card). `gift-cards/customer-picker.tsx`
  is deleted; its copy moved to `customerPickerContent.lookup` (with Hindi).
- Variant picker (PO/transfer lines), supplier picker, inbound shipment PO search, metaobject
  reference search dialog, menu destination picker and the draft order customer search draw
  through RecordCombobox.

## Not done here

- `ui/label` used directly (58 files) and labels inside the theme customizer panels: left alone.
- Search boxes left as they are: command palette, resource table toolbar (tables step), media
  library toolbar (borderless), theme code search, theme link picker panel (uses
  `text-[0.8125rem]`, tokens step), catalog price table (tables step), top bar search button.
- `Input size="kit"` callers untouched (it is an alias of `lg`).
