/** SOURCE OF TRUTH: the browser-safe half of Edit code — WHAT: the checks and file names the editor shares with the server / WHY: client components must not import the server barrel (it pulls the database driver into the browser) */
export * from './check'
export * from './paths'
