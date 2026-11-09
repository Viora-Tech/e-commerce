import { createFileRoute } from '@tanstack/react-router'

/**
 * SPIKE: only does something in a `VITE_LAB_STRESS=1` build (after `bun stress/gen.ts`), where
 * it pulls every admin client module into the bundle so the build's memory can be measured.
 */
export const Route = createFileRoute('/_admin/stress')({
  loader: async () => {
    if (import.meta.env.VITE_LAB_STRESS !== '1') return 0
    // A glob, so a normal build works without the generated (gitignored) file.
    const load = Object.values(import.meta.glob<{ all: unknown[] }>('../../stress-all.gen.ts'))[0]
    return load ? (await load()).all.length : 0
  },
  component: StressPage,
})

function StressPage() {
  const count = Route.useLoaderData()
  return <p className="p-6">{count} modules</p>
}
