# CodeBuild + ECR image pipeline (code only)

Branch `chore/codebuild-images`. Production images move off the server: CodeBuild (ARM) builds
worker/admin/storefront, pushes to ECR, then calls the Dokploy API to deploy one at a time
(worker, admin, storefront). No AWS resource exists yet and Dokploy is untouched.

- Code: `deploy/codebuild/` (`buildspec.yml`, `detect-changes.sh`, `build-images.sh`,
  `deploy-dokploy.mjs`, `README.md` with the AWS CLI commands).
- Docs: `apps/docs/content/developer-docs/operations/codebuild.mdx`.
- Only build-time input is the public `NEXT_PUBLIC_WORKER_URL` (admin). No secret at build.
- Last deployed sha per app lives in SSM `/vextro/deploy/last-sha/<app>`.
- Dokploy field names used (`application.saveDockerProvider`, `application.deploy`,
  `application.one` deployments status) are from the API tool schemas, not yet run against the
  live server: first real run should be `SKIP_DEPLOY=1`, then one app.
- Undone: create AWS resources, switch Dokploy apps to the Docker provider, retire the server
  cron, update the "Test server deploys" paragraph in the Deployment page afterwards.
