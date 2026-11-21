# Third-party licences: agent skills in `.claude/skills/koomerce-*`

The Koomerce skills are our own text. The checklists in `koomerce-commerce-patterns`
(`SKILL.md` and `reference.md`), the "Money-path checklist" in `koomerce-checkout-orders` and
the "Which layer to write" section in `koomerce-testing` are adapted, rewritten in our words and
mapped to our files, from the skills below. Medusa-specific APIs were dropped.

The code patterns themselves come from Medusa core (https://github.com/medusajs/medusa, MIT
outside its Enterprise Edition files) and are credited in the code comments; no Medusa code is
copied.

Not used: https://github.com/medusajs/medusa-agent-skills (Medusa's official skills). As of
commit c5a56b4 (checked 20 Nov 2026) it has no licence file and GitHub reports no licence, so
none of its text was read into or adapted for this repo. `.claude/skills/README.md` only tells
developers how to install it themselves.

## OrcaQubits agentic-commerce-skills-plugins

- Source: https://github.com/OrcaQubits/agentic-commerce-skills-plugins, commit e7a890a,
  folder `medusa-commerce/skills/`: `medusa-cart-checkout`, `medusa-orders`, `medusa-payments`,
  `medusa-pricing`, `medusa-fulfillment`, `medusa-security`, `medusa-testing`,
  `medusa-workflows`, `nextjs-patterns`, `medusa-storefront`.
- Found through https://github.com/medusajs/medusa-community-skills (MIT, Copyright (c) 2026
  Medusa), a list of links; nothing from the list itself is copied.

```
MIT License

Copyright (c) 2024-2026 OrcaQubits AI (https://orcaqubits-ai.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## finsilabs awesome-ecommerce-skills

- Source: https://github.com/finsilabs/awesome-ecommerce-skills, commit fa38550,
  `skills/headless-modern/medusa-development/SKILL.md` (best practices and pitfalls: re-read
  the entity in an event handler, keep core logic out of handlers, compensation on every
  side-effect step).

```
MIT License

Copyright (c) 2026 awesome-ecommerce-skills contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
