# Theme import: setting helpers split out of import.ts

`#1075` and `#1076` both grew `packages/core/src/theme-import/import.ts`, which put it at 503
lines and failed the file-size sweep on `dev`. `storedValue`, `storedSettings` and
`templateBlocks` moved unchanged to `theme-import/stored-settings.ts`. No behaviour change.
