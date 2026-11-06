# Imported Horizon themes render correctly

Horizon uses Shopify features the Liquid engine lacked.

- `content_for`: arguments reach the block (`variant`), `closest.x: value` is carried down, static blocks stay out of `content_for 'blocks'`, a disabled static block shows nothing, and one the template never saved runs on its defaults.
- Dynamic sources in block settings (`{{ closest.product }}`, `<h3>{{ closest.product.title }}</h3>`) are filled per render (`dynamicSettings`). The import report no longer lists them as missing products.
- `block`, `section` and `closest` reach a block's snippets.
- `concat` treats one object as a list of one, and `reject` compares with an object's own value.
- `headerWrapper`: the element around the header group is drawn by the store layout. Split across slots, it broke hydration and drew the page twice.
- `videoNamesOf` skips a video behind a slide set to an image, so live videos pair with the right names.

Themes imported before this need importing again: static blocks and video names are saved at import.

Tested with `static-blocks.test.ts`, all theme import tests, typecheck, and the Claw Gears Horizon 3.2.1 theme rendered in a local test.
