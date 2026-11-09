# GitHub Actions turned off (8 Nov 2026)

At the owner's request:
- Actions is disabled for the `e-commerce` repo (repo settings), and both workflows (CI, Release) are disabled.
- `.github/workflows/ci.yml` and `release.yml` are commented out line by line. Uncomment them, then re-enable Actions in the repo settings, to bring them back.

Checks keep running locally before each PR (typecheck, biome, lint:components, sweeps). Releases are built locally and pushed to ECR (see the release notes on GitHub).
