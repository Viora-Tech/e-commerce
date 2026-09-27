import { describe, expect, it } from 'vitest'
import { shouldRestart, workspaceClosure } from './dev'

describe('workspaceClosure', () => {
  const pkg = (name: string, dependencies: Record<string, string> = {}) =>
    [name, { dir: `/repo/${name}`, manifest: { name, dependencies } }] as const

  it('follows workspace dependencies transitively and ignores registry ones', () => {
    const packages = new Map([
      pkg('worker', { core: 'workspace:*', hono: '^4.0.0' }),
      pkg('core', { db: 'workspace:*', config: 'workspace:^' }),
      pkg('db', { config: 'workspace:*' }),
      pkg('config'),
      pkg('admin', { core: 'workspace:*' }),
    ])
    expect(workspaceClosure('worker', packages).sort()).toEqual(
      ['/repo/config', '/repo/core', '/repo/db', '/repo/worker'].sort(),
    )
  })
})

describe('shouldRestart', () => {
  it('restarts on source and manifest changes', () => {
    expect(shouldRestart('src/orders/service.ts')).toBe(true)
    expect(shouldRestart('src\\emails\\order.tsx')).toBe(true)
    expect(shouldRestart('package.json')).toBe(true)
  })

  it('ignores tests, build output, dependencies and non-code files', () => {
    expect(shouldRestart('src/orders/service.test.ts')).toBe(false)
    expect(shouldRestart('node_modules/zod/index.js')).toBe(false)
    expect(shouldRestart('dist/index.js')).toBe(false)
    expect(shouldRestart('.turbo/turbo-build.log')).toBe(false)
    expect(shouldRestart('README.md')).toBe(false)
  })
})
