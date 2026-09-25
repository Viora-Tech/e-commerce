/**
 * Stands in for `@theguild/remark-mermaid/mermaid`, the module Nextra's remark plugin imports
 * `{ Mermaid }` from for every ```mermaid block (aliased in next.config.mjs), so diagrams
 * render through our themed component instead of the stock one.
 */
export { default as Mermaid } from './mermaid'
