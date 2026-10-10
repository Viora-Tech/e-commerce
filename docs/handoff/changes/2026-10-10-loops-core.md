# Loops (list bindings), part 1: core and storefront

Branch `feat/loops-core` (plan C2a). Editor UI ("Use content from…") is the next PR.

- New list binding on any `array` field: `{ $loop: { source, limit, map }, fallback }`
  (`packages/core/src/dynamic-sources/loops.ts`). Sources: `metaobject:<type>` and
  `collection:<handle>.products`; limit capped at 50; `map` names the entry/product field and the
  setting kind for each item field.
- Loading: `loop-service.ts` (`loadLoopValues`), one definition query plus one entries read per
  content type, products through the storefront's `collectionCards`; RLS throughout.
- Storefront: `template-render.tsx` fills loops before single-value bindings. Empty or unreadable
  lists render the typed-in rows (`fallback`). `applyBindings` alone also shows the fallback, so
  the editor never hands a section the loop object.
- Save: `assertTemplateBindings` also runs `loopProblems` (unknown source, hidden or deleted
  content type, unreadable map).
- Single-value `$source` bindings are unchanged.
- Tests (not run): `loops.test.ts` (pure), `loop-service.test.ts` (database, RLS, cap, Save).
- Docs: developer docs Dynamic sources → "Lists (loops)".
