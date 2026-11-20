# Agent skills in this repo

- `koomerce-*`: how this monorepo works (conventions, checkout and orders, delivery options,
  themes, plugin apps, emails, testing, release flow, and the Medusa-derived commerce patterns).
  Each `SKILL.md` names its sources and the date it was checked against `dev`.
- The others (`brandkit`, `design-taste-frontend`, `minimalist-ui`, ...) are third-party design
  skills; see `THIRD_PARTY_NOTICES.md`.
- The public pack for merchants, app and theme developers is `skills/` at the repo root.

## Medusa's own skills

Several patterns in our checkout, payments, refunds, discounts, shipping and returns code come
from Medusa (MIT core). `koomerce-commerce-patterns` lists each one with our files, the rule and
the test. It is written in our words and maps to our code.

For raw Medusa reference, a developer can install Medusa's skills on their own machine:

```sh
npx skills add medusajs/medusa-agent-skills
```

They describe Medusa's APIs (workflows SDK, modules, `medusa-config.ts`, the JS SDK), not ours,
so treat them as background reading. Do not copy their code or text into this repo: as of
20 Nov 2026 that repository has no licence file. Install them outside the repo or keep them out
of commits.

Community Medusa skills are listed at
[medusajs/medusa-community-skills](https://github.com/medusajs/medusa-community-skills); each
has its own licence. Check it before adapting anything, and credit it in
`THIRD_PARTY_NOTICES.md`.
