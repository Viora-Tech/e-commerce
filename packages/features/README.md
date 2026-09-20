# Features

Each feature is one package: `packages/features/<name>` with a single public
entry `src/index.ts`. A feature may import `@commerce/core` and `@commerce/db`.
`core` and `db` never import a feature. Apps wire features in one `features.ts`
file each. When the plugin system arrives, that file becomes the registry and
each package gains a manifest. Nothing else moves.

Empty in session one.
