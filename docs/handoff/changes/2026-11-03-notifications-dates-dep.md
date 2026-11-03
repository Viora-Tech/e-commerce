# Worker image: @commerce/dates is a runtime dependency of notifications

`packages/notifications/src/samples.ts` imports `@commerce/dates` at runtime, but the package
listed it under `devDependencies`. The worker image installs with `--production`, so the link
was missing and the worker stopped at start with `Cannot find module '@commerce/dates'`
(image a66f7d7d2). Moved it to `dependencies`; bun.lock updated. Checked by building the worker
image and starting it: it now loads every module and stops only at the missing database env.
