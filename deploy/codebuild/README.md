# Builds on CodeBuild

CodeBuild (ARM) builds the `worker`, `admin` and `storefront` images, pushes them to ECR, then
calls the Dokploy API to deploy each changed app one at a time (worker first, it runs
migrations). The server stops building. Full guide, switch steps, rollback and cost:
`apps/docs/content/developer-docs/operations/codebuild.mdx`.

Files here:

| File | Job |
| --- | --- |
| `buildspec.yml` | CodeBuild phases: ECR login, detect changes, build, deploy |
| `detect-changes.sh` | Apps whose files changed since the last deployed sha (SSM `/vextro/deploy/last-sha/<app>`), or all with `BUILD_ALL=1` |
| `build-images.sh` | BuildKit build with ECR registry cache; tags `:<git sha>` and `:dev-latest` |
| `deploy-dokploy.mjs` | Dokploy `saveDockerProvider` + `deploy`, polls until done, stops on failure |

## Build-time env (no secret is needed to build)

| Name | Where | Used by |
| --- | --- | --- |
| `NEXT_PUBLIC_WORKER_URL` | SSM `/vextro/deploy/next-public-worker-url` (public) | `apps/admin/Dockerfile` build-arg, inlined in the browser bundle |

Nothing else: storefront and worker Dockerfiles take no build args, and Sentry source-map upload
is disabled in both `next.config.ts` (no `SENTRY_AUTH_TOKEN`). Runtime secrets stay in Dokploy.

## AWS resources (variables, then commands)

```bash
export AWS_REGION=ap-south-1
export AWS_ACCOUNT_ID=<12-digit id>
export PREFIX=vextro
export GITHUB_REPO=https://github.com/Viora-Tech/<repo>   # the commerce monorepo

# 1. ECR repos, keep the last 20 images (the buildcache tag counts as an image, so 25)
for app in worker admin storefront; do
  aws ecr create-repository --region $AWS_REGION --repository-name $PREFIX/$app \
    --image-scanning-configuration scanOnPush=true
  aws ecr put-lifecycle-policy --region $AWS_REGION --repository-name $PREFIX/$app \
    --lifecycle-policy-text '{"rules":[{"rulePriority":1,"description":"keep last 25","selection":{"tagStatus":"any","countType":"imageCountMoreThan","countNumber":25},"action":{"type":"expire"}}]}'
done

# 2. Parameters (SSM) and the Dokploy API key (Secrets Manager). Values are yours to fill in.
aws ssm put-parameter --name /vextro/deploy/dokploy-url --type String --value https://<dokploy-host>
aws ssm put-parameter --name /vextro/deploy/next-public-worker-url --type String --value https://<worker-public-url>
for a in worker admin storefront; do
  aws ssm put-parameter --name /vextro/deploy/dokploy-app-id-$a --type String --value <applicationId>
done
aws secretsmanager create-secret --name vextro/dokploy --secret-string '{"api-key":"<dokploy api key>"}'

# 3. IAM role for the build
cat > trust.json <<'JSON'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"codebuild.amazonaws.com"},"Action":"sts:AssumeRole"}]}
JSON
aws iam create-role --role-name vextro-codebuild --assume-role-policy-document file://trust.json
cat > policy.json <<JSON
{"Version":"2012-10-17","Statement":[
 {"Effect":"Allow","Action":"ecr:GetAuthorizationToken","Resource":"*"},
 {"Effect":"Allow","Action":["ecr:BatchCheckLayerAvailability","ecr:BatchGetImage","ecr:GetDownloadUrlForLayer","ecr:InitiateLayerUpload","ecr:UploadLayerPart","ecr:CompleteLayerUpload","ecr:PutImage"],"Resource":"arn:aws:ecr:$AWS_REGION:$AWS_ACCOUNT_ID:repository/$PREFIX/*"},
 {"Effect":"Allow","Action":["logs:CreateLogGroup","logs:CreateLogStream","logs:PutLogEvents"],"Resource":"*"},
 {"Effect":"Allow","Action":["ssm:GetParameter","ssm:GetParameters"],"Resource":"arn:aws:ssm:$AWS_REGION:$AWS_ACCOUNT_ID:parameter/vextro/deploy/*"},
 {"Effect":"Allow","Action":"ssm:PutParameter","Resource":"arn:aws:ssm:$AWS_REGION:$AWS_ACCOUNT_ID:parameter/vextro/deploy/last-sha/*"},
 {"Effect":"Allow","Action":"secretsmanager:GetSecretValue","Resource":"arn:aws:secretsmanager:$AWS_REGION:$AWS_ACCOUNT_ID:secret:vextro/dokploy-*"}
]}
JSON
aws iam put-role-policy --role-name vextro-codebuild --policy-name build --policy-document file://policy.json

# 4. GitHub access: create a CodeConnections connection once in the console (Developer Tools >
#    Connections > GitHub), authorise it, and note its ARN (CONNECTION_ARN). Needed for private repos.

# 5. The project: ARM large (8 GB, admin needs > 4 GB), privileged for Docker, full git history
aws codebuild create-project --region $AWS_REGION --name vextro-images \
  --source "type=GITHUB,location=$GITHUB_REPO,gitCloneDepth=0,buildspec=deploy/codebuild/buildspec.yml,auth={type=CODECONNECTIONS,resource=$CONNECTION_ARN}" \
  --source-version dev \
  --artifacts type=NO_ARTIFACTS \
  --environment "type=ARM_CONTAINER,computeType=BUILD_GENERAL1_LARGE,image=aws/codebuild/amazonlinux-aarch64-standard:3.0,privilegedMode=true,environmentVariables=[{name=AWS_ACCOUNT_ID,value=$AWS_ACCOUNT_ID,type=PLAINTEXT},{name=ECR_PREFIX,value=$PREFIX,type=PLAINTEXT}]" \
  --service-role arn:aws:iam::$AWS_ACCOUNT_ID:role/vextro-codebuild \
  --timeout-in-minutes 60

# 6. Nightly trigger, 02:30 IST = 21:00 UTC
aws iam create-role --role-name vextro-eventbridge-codebuild --assume-role-policy-document \
  '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"events.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
aws iam put-role-policy --role-name vextro-eventbridge-codebuild --policy-name start --policy-document \
  "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"codebuild:StartBuild\",\"Resource\":\"arn:aws:codebuild:$AWS_REGION:$AWS_ACCOUNT_ID:project/vextro-images\"}]}"
aws events put-rule --name vextro-nightly-images --schedule-expression 'cron(0 21 * * ? *)'
aws events put-targets --rule vextro-nightly-images --targets \
  "Id=1,Arn=arn:aws:codebuild:$AWS_REGION:$AWS_ACCOUNT_ID:project/vextro-images,RoleArn=arn:aws:iam::$AWS_ACCOUNT_ID:role/vextro-eventbridge-codebuild"
```

Optional push trigger: `aws codebuild create-webhook --project-name vextro-images --filter-groups '[[{"type":"EVENT","pattern":"PUSH"},{"type":"HEAD_REF","pattern":"^refs/heads/dev$"}]]'`.
That deploys on every push, which the owner chose not to do (builds + restarts); leave it off.

## Run it

```bash
# Dry run: build and push only, nothing touches Dokploy
aws codebuild start-build --project-name vextro-images \
  --environment-variables-override name=SKIP_DEPLOY,value=1,type=PLAINTEXT
# Build everything and deploy
aws codebuild start-build --project-name vextro-images \
  --environment-variables-override name=BUILD_ALL,value=1,type=PLAINTEXT
```
