# One-step production rollback: `deploy/rollback.sh`

Roadmap item agreed 6 Nov. Rolling an app back used to mean editing the Dokploy image by hand and
resetting the SSM last-sha. Now one command does it, per app:

```bash
deploy/rollback.sh admin                    # dry run (default): live image, recent tags, the plan
deploy/rollback.sh admin --apply            # back to the image pushed before the live one
deploy/rollback.sh worker --to <sha> --apply
```

- Apps `worker`, `admin`, `storefront`. Environment: `DOKPLOY_URL`, `DOKPLOY_API_KEY`,
  `DOKPLOY_APP_ID_<APP>` (same names as `deploy/codebuild/deploy-dokploy.mjs`); optional
  `ECR_REGISTRY` (default `924422830513.dkr.ecr.ap-south-1.amazonaws.com`), `ECR_PREFIX`
  (`vextro`), `AWS_REGION` (`ap-south-1`), `DEPLOY_TIMEOUT_MIN` (15). No secret is in the file; the
  token reaches curl through a file descriptor, not the command line.
- Reads the live image from `application.one`, lists the last 20 images of `vextro/<app>` with
  `aws ecr describe-images` (newest first; `:buildcache`, `latest` and `dev-latest` left out) and
  picks the one pushed just before the live tag. `--to <tag>` picks instead (checked against ECR),
  `--last <n>` lists more.
- `--apply`: `application.saveDockerProvider` (registry fields empty, as the deploy script does),
  `application.deploy` titled "Rollback to <sha>", SSM `/vextro/deploy/last-sha/<app>` set to that
  sha, then waits for the Dokploy deployment (`--no-wait` to skip).
- Needs `curl`, `node` (to read JSON, no `jq`) and the AWS CLI.
- Docs: developer docs Deployment → Rollback → "One-step rollback" (with a dry-run example),
  a pointer in Builds on CodeBuild → Rollback, and a line in the Release checklist; `deploy/README.md`.

Checked: shellcheck 0.10.0 clean. No live call was made: the dry run, `--to`, a bad `--to`, and
`--apply` (with the wait loop) were run against stubbed `curl` and `aws` on `PATH`. The repo has no
tests for deploy shell scripts. The first real use should be a dry run on the server, then
`--apply` on the storefront or admin outside peak hours.
