# Handoff note template

File: `docs/handoff/changes/YYYY-MM-DD-short-title.md` (the date the work was done, kebab-case
title). Heading = what changed. Then what a new session needs to know.

```md
# <What changed, in one line>

Branch `<branch>` (from `origin/dev`). Issue #<n> if any. Migration `<NNNN_name>` or "No migration".

## What changed

- <behaviour, in the owner's words where they decided it>
- <where the code lives: file paths and the main functions>

## Tests

- <test files added or changed, and whether they were run here>

## Left to do / for the owner to check

- <anything not done, open questions, what to check on localhost>
```

Keep it factual and short. Name files and functions so the next session can jump straight in.
