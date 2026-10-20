# Release workflow builds to ECR

`.github/workflows/release.yml` now pushes `vextro/<admin|storefront|worker>:<sha>` to ECR
(ap-south-1), the registry the production Dokploy apps pull from, instead of GHCR. It still runs
only by hand (Actions → Release → Run workflow); the owner paused the push trigger on 2026-10-02.
The Dokploy webhook step is gone: rollout stays a separate human step (worker first, it runs
migrations). The unused `tasks` image is dropped.

Needs two repo settings before the first run:
- `vars.AWS_ROLE_ARN`: an IAM role GitHub assumes over OIDC, with ECR push on `vextro/*`.
- `vars.NEXT_PUBLIC_WORKER_URL`: `https://api.koomerce.app`.

`apps/docs/content/developer-docs/operations/deployment.mdx` still describes the GHCR flow; update
it once the first ECR run succeeds.
