# Koomerce skills

Agent skills for [Koomerce](https://koomerce.app), the Indian D2C commerce platform. Each skill
is a folder with a `SKILL.md` in the open [Agent Skills](https://agentskills.io) format, so it
works with Claude Code, Codex, Cursor and any other agent that reads skills.

Skills here are maintained in the Koomerce repository and reviewed like code. Read a skill before
you install it: a skill is instructions your agent will follow.

## Contents

- [Merchant and store agents](#merchant-and-store-agents)
- [App and theme developers](#app-and-theme-developers)
- [Install a skill](#install-a-skill)
- [Contribute a skill](#contribute-a-skill)
- [Skills for working on this repository](#skills-for-working-on-this-repository)

## Merchant and store agents

- [koomerce-store-agent](koomerce-store-agent) - Works in a Koomerce store through its MCP
  server: reads orders, products, stock and sales, and proposes changes only after the merchant
  confirms them.

## App and theme developers

- [koomerce-app-developer](koomerce-app-developer) - Builds Koomerce apps: manifest, honest
  access declaration, providers and their conformance tests, admin pages, hooks and app blocks.
- [koomerce-theme-developer](koomerce-theme-developer) - Brings a Shopify Liquid theme to
  Koomerce: what the importer supports, what is swapped for Koomerce features, and how to test.

## Install a skill

Skills target the Koomerce platform as of November 2026 (see each skill's `metadata`).

### With `npx skills` (any agent)

```sh
# pick from the list
npx skills add Viora-Tech/e-commerce --list

# one skill, into the current project
npx skills add Viora-Tech/e-commerce --skill koomerce-store-agent

# straight from its folder
npx skills add https://github.com/Viora-Tech/e-commerce/tree/main/skills/koomerce-store-agent

# for every project on this machine, Claude Code only
npx skills add Viora-Tech/e-commerce --skill koomerce-app-developer -g -a claude-code
```

The repository also holds the skills its own developers use (in `.claude/skills/`), so always
name the skill with `--skill` or use the folder URL.

### As a Claude Code plugin marketplace

This folder is a plugin marketplace (`skills/.claude-plugin/marketplace.json`, name
`koomerce-skills`). Because it lives in a subfolder of the repository, add it from a clone:

```sh
git clone https://github.com/Viora-Tech/e-commerce.git
claude plugin marketplace add ./e-commerce/skills
claude plugin install koomerce-store-agent@koomerce-skills
claude plugin install koomerce-app-developer@koomerce-skills
claude plugin install koomerce-theme-developer@koomerce-skills
```

Inside a session the same works as `/plugin marketplace add ./e-commerce/skills` and
`/plugin install koomerce-store-agent@koomerce-skills`.

Or register it without cloning, in your Claude Code `settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "koomerce-skills": {
      "source": {
        "source": "github",
        "repo": "Viora-Tech/e-commerce",
        "path": "skills/.claude-plugin/marketplace.json"
      }
    }
  }
}
```

then `/plugin install koomerce-store-agent@koomerce-skills`.

### Connect your store first (store agent)

In the Koomerce admin open Settings, MCP & API, and connect your AI client (it signs in with
OAuth), or create an access token for a script. Choose which areas it may read or change. Turn
on "Allow AI clients to make changes" only if you want changes to run; sensitive ones (refunds,
cancellations, deletes, payments, staff, billing, domains) always wait for your approval in the
admin.

## Contribute a skill

See [CONTRIBUTING.md](CONTRIBUTING.md) for the listing rules and the entry format.

## Skills for working on this repository

Agents developing Koomerce itself use the skills in `.claude/skills/koomerce-*` at the
repository root (conventions, apps, delivery options, Liquid themes, checkout and orders,
testing, release flow, emails). They describe internal workflows and are not part of this pack.

## Resources

- Developer docs: "Agent skills", "Plugins SDK and app blocks", "MCP server and API tokens",
  "Shopify theme import" (in `apps/docs`)
- [Agent Skills specification](https://agentskills.io/specification)
