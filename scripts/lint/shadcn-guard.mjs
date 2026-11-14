/**
 * The `@shadcn/lint` rules under a second name, `shadcn-guard`, so `.oxlintrc.json` can run
 * `no-restyle` twice: as a warning for every component (`shadcn/no-restyle`) and as an error for
 * the shared admin parts the design audit settled (`shadcn-guard/no-restyle`, 14 Nov 2026).
 * Oxlint keys rule severity by plugin name, so one plugin cannot do both. See docs/guardrails.md.
 */
import shadcn from '@shadcn/lint'

export default { meta: { name: 'shadcn-guard' }, rules: shadcn.rules }
