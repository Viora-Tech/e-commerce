# Admin: big client pieces load when used (8 Nov 2026)

Four things moved out of the JavaScript every admin page (or a busy page) downloads up front:

- **Home globe** (`components/home/live-now.tsx`): `cobe` and the globe overlay load with
  `next/dynamic` (`ssr: false`). The card already waited for a WebGL check and has a fixed height,
  so nothing moves.
- **Rich-text editor** (`components/fields/rich-text-field.tsx`): Lexical and its plugins load
  in their own chunk for all seven forms (product, collection, blog post, page, policy,
  metaobject field, editor playground). A rem-sized skeleton stands in meanwhile.
- **AI assistant panel** (`components/assistant/assistant-host.tsx`): the panel (composer,
  answers, action cards, sources) loads the first time it opens. The host also stopped making
  its own `ai.status` request and now uses the cached `useAssistantEnabled` read that the top bar
  and the palette already share, so it is one request per page load instead of two.
- **Command palette and shortcuts list** (`components/layout/palette-host.tsx`): each loads on
  first open and then stays mounted so closing still animates. Shortcuts keep working.

Left for later (see the perf report): `motion` without `LazyMotion` (54 files), and Better
Auth's `passkeyClient()` in `packages/auth/src/client.ts`, which bundles `@simplewebauthn/browser`
into the shell through `authClient`.
