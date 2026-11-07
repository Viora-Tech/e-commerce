# Reviewer email goes to the password step (2026-11-07)

- Shopify paused the app review because the reviewer got an email code. The login page now passes
  a SHA-256 of `REVIEWER_LOGIN_EMAIL` (not the address) to the form; typing that address and
  pressing Continue opens the password step instead of sending a code. The "Sign in with a
  password" link stays. Fixes #1259.
