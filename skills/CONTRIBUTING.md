# Contributing a Koomerce skill

Thank you for helping agents work better with Koomerce. A skill can live in this folder (send a
pull request with the skill) or in your own public repository (send a pull request that adds a
link to the README).

## Listing rules

A skill is listed when it:

1. **Is about Koomerce**: running a Koomerce store, building a Koomerce app or theme, or
   integrating with Koomerce's MCP server or API.
2. **Follows the Agent Skills format**: a folder named like the skill with a `SKILL.md` whose
   YAML frontmatter has `name` (lowercase letters, digits and single hyphens, at most 64
   characters, the same as the folder name) and `description` (at most 1,024 characters, saying
   what the skill does and when to use it). Keep `SKILL.md` short; put long material in
   `references/`.
3. **States its target version**: `metadata.koomerce-version` names the Koomerce release or
   month it was checked against (for example `"Koomerce platform, November 2026"`). Re-check the
   skill when Koomerce changes the tools or APIs it names.
4. **Names only real tools and paths**: every MCP tool, admin action path, file path and command
   must exist in the target version. Agents should be told to discover anything else
   (`tools/list`, `searchActions`), never to guess.
5. **Asks before changing a store**: a skill that can write to a store must tell the agent to
   confirm each change with the merchant first and to respect approvals and refusals.
6. **Contains no secrets or private data**: no API keys, tokens, passwords, customer data,
   private URLs or internal hostnames, not even as examples. Use placeholders such as
   `<store slug>`.
7. **Hides nothing**: no obfuscated text or code, and no instructions unrelated to its purpose
   (such as sending data to a third party without the user knowing). Scripts, if any, are
   readable and documented.
8. **Is not a copy** of an existing skill here without meaningful changes.
9. **Says its licence** in the `license` frontmatter field when it lives in its own repository.
   Skills in this folder are under the MIT licence in `LICENSE`.

## Add a skill to this folder

1. Fork the repository and branch from `dev`.
2. Create `skills/<skill-name>/SKILL.md` (and `references/` if needed).
3. Add an entry to the right section of `skills/README.md`, in alphabetical order.
4. Add a plugin entry for it in `skills/.claude-plugin/marketplace.json` (same `name`, `"source": "./"`,
   `"strict": false`, `"skills": ["./<skill-name>"]`).
5. Open a pull request into `dev` with a note in `docs/handoff/changes/`.

## List a skill from your own repository

Add one bullet to the right README section:

```md
- [skill-name](https://github.com/you/your-repo/tree/main/path/to/skill) - One sentence that starts with a verb and ends with a period. By [@you](https://github.com/you).
```

- The link text is the `name` from the skill's frontmatter.
- Link to the skill's folder or repository, not to a commit.
- One sentence, starting with a verb, no marketing words ("best", "ultimate").
- Your repository needs a README saying what the skill does and how to install it.

## Review before install

Maintainers read every listed skill before merging, but you should too. A skill is a set of
instructions your agent follows with your permissions. Before installing:

- read `SKILL.md` and every file it references;
- check what it lets the agent change, and that it asks you first;
- prefer pinning to a reviewed commit when your tool supports it.

## Updates and removals

Open a pull request to change an entry. Skills that are unmaintained, have broken links, or no
longer meet these rules may be removed.
