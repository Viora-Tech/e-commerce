/** SOURCE OF TRUTH: module load order — WHAT: the channel module loads on its own in a fresh process, before the template specs / WHY: a top-level read across the whatsapp.ts ↔ template-specs.ts import cycle broke the admin production build ("Cannot access … before initialization"). Vitest's own loader hid it, so this runs plain bun. */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const entry = fileURLToPath(new URL('../src/whatsapp.ts', import.meta.url))
  .split('\\')
  .join('/')

it('loads whatsapp.ts first in a fresh process', () => {
  // Through the shell so bun is found on Windows too.
  const run = spawnSync(`bun -e "await import('${entry}')"`, {
    encoding: 'utf8',
    shell: true,
    timeout: 60_000,
  })
  expect(run.error).toBeUndefined()
  expect(run.stderr).not.toMatch(/before initialization/)
  expect(run.status).toBe(0)
})
