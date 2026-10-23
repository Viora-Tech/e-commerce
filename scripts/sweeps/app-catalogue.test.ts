/**
 * Sweep: the App Store site (apps/www) lists apps from `packages/core/src/apps/catalogue.generated.ts`,
 * copied from the plugin manifests' `listing`. Not a ratchet: when a manifest changes, regenerate
 * it with `bun scripts/gen-app-catalogue.ts`. Also checks every listed logo ships on both sites.
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import config from '../../commerce.config'
import { APP_LOGOS } from '../../packages/core/src/apps/catalogue'
import { APP_CATALOGUE_DATA } from '../../packages/core/src/apps/catalogue.generated'
import { collectCatalogue } from '../gen-app-catalogue'
import { ROOT } from './walk'

describe('sweep: app-catalogue', () => {
  it('matches the plugin manifests (run bun scripts/gen-app-catalogue.ts)', () => {
    expect(APP_CATALOGUE_DATA).toEqual(collectCatalogue(config.plugins))
  })

  it('ships every app logo in the admin and on the App Store site', () => {
    const missing = Object.values(APP_LOGOS).flatMap((file) =>
      ['apps/admin/public', 'apps/www/public']
        .map((dir) => path.join(ROOT, dir, file))
        .filter((p) => !existsSync(p)),
    )
    expect(missing).toEqual([])
  })
})
