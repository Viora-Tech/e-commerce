/**
 * Sweep: the platform's brand name. "Vextro" (it may change) is spelled once, in
 * `siteConfig.brand.name` (`packages/config/src/site.ts`); templates, user agents, admin copy
 * and emails read it from there, so a rename is one edit. A string or JSX text that contains
 * the literal name, outside the config and tests, fails. Not allow-listed: there is nothing
 * left to list.
 */
import { siteConfig } from '@commerce/config/site'
import { describe, expect, it } from 'vitest'
import { brandNameSites } from './consistency'

describe('sweep: site-config', () => {
  it('the brand name appears only in siteConfig', async () => {
    const files = await brandNameSites(siteConfig.brand.name)
    expect(
      files,
      `read siteConfig.brand.name from @commerce/config/site instead of the literal:\n${files.join('\n')}`,
    ).toEqual([])
  })
})
