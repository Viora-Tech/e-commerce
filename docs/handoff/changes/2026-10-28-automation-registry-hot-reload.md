# Dev: automation built-ins survive hot reload (#901)

The admin dev server crashed after a file change with `automation action "order.add_tags"
registered twice`: hot reload re-runs `packages/core/src/automations/actions/index.ts` (its
`registered` flag starts false again) while the registry keeps its executor map.
`registerActionExecutor` takes `{ replace: true }`, which `registerBuiltinActions` uses, so the
built-ins replace their own earlier registration (the newest code wins); any other second owner
of an action id still throws. Production loads modules once and was not affected.

Tests: core `automations/actions/index.test.ts` (a fresh copy of the module re-registers without
throwing; a different second owner still throws).
