#!/usr/bin/env bash
# One-step production rollback: points one Dokploy application (worker, admin or storefront)
# back at an earlier ECR image tag and redeploys it. No rebuild: every release leaves its image
# in ECR tagged with its commit sha (deploy/codebuild/build-images.sh).
#
# Dry run by default: it reads the live image and the ECR tags and prints what it would do.
# Nothing changes until you pass --apply.
#
# Usage:
#   deploy/rollback.sh <worker|admin|storefront> [--to <tag>] [--last <n>] [--apply] [--no-wait]
#
#   --to <tag>   roll back to this tag instead of the one pushed just before the live one
#   --last <n>   how many recent ECR images to list and choose from (default 20)
#   --apply      really change the application and redeploy (otherwise: dry run)
#   --no-wait    with --apply: start the deploy and return without waiting for it
#
# Environment (never hard-code these; the same names deploy/codebuild/deploy-dokploy.mjs reads):
#   DOKPLOY_URL               e.g. https://dokploy.example.com
#   DOKPLOY_API_KEY           Dokploy API token (Settings → Profile → API keys)
#   DOKPLOY_APP_ID_<APP>      the application id, e.g. DOKPLOY_APP_ID_ADMIN
#   ECR_REGISTRY              default 924422830513.dkr.ecr.ap-south-1.amazonaws.com
#   ECR_PREFIX                default vextro (repositories are <prefix>/<app>)
#   AWS_REGION                default ap-south-1
#   DEPLOY_TIMEOUT_MIN        how long --apply waits for the deploy (default 15)
#
# Needs: bash, curl, node (to read JSON) and the AWS CLI with ecr:DescribeImages (and
# ssm:PutParameter for --apply, which moves /vextro/deploy/last-sha/<app> so the next build
# rebuilds this app from the rolled-back commit).
#
# The worker runs migrations; rolling it back does not undo them. See the developer docs,
# Deployment → Rollback, before rolling back across a migration.
set -euo pipefail

APPS="worker admin storefront"
ECR_REGISTRY="${ECR_REGISTRY:-924422830513.dkr.ecr.ap-south-1.amazonaws.com}"
ECR_PREFIX="${ECR_PREFIX:-vextro}"
AWS_REGION="${AWS_REGION:-ap-south-1}"
TIMEOUT_MIN="${DEPLOY_TIMEOUT_MIN:-15}"

usage() {
  sed -n '9,15p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

die() {
  echo "rollback: $*" >&2
  exit 1
}

app=""
to=""
last=20
apply=false
wait=true
while [ $# -gt 0 ]; do
  case "$1" in
    --to)
      [ $# -ge 2 ] || die "--to needs a tag"
      to="$2"
      shift 2
      ;;
    --last)
      [ $# -ge 2 ] || die "--last needs a number"
      last="$2"
      shift 2
      ;;
    --apply) apply=true; shift ;;
    --no-wait) wait=false; shift ;;
    -h | --help) usage 0 ;;
    -*) die "unknown option $1 (see --help)" ;;
    *)
      [ -z "$app" ] || die "one app at a time"
      app="$1"
      shift
      ;;
  esac
done

[ -n "$app" ] || usage 1
case " $APPS " in
  *" $app "*) ;;
  *) die "app must be one of: $APPS" ;;
esac
case "$last" in
  '' | *[!0-9]*) die "--last must be a number" ;;
esac
[ "$last" -ge 2 ] || die "--last must be at least 2"
case "$to" in
  *[!A-Za-z0-9._-]*) die "--to: a tag is letters, digits, dot, dash and underscore" ;;
esac

for cmd in curl node aws; do
  command -v "$cmd" >/dev/null 2>&1 || die "$cmd is not installed"
done

env_name="DOKPLOY_APP_ID_$(printf '%s' "$app" | tr '[:lower:]-' '[:upper:]_')"
: "${DOKPLOY_URL:?DOKPLOY_URL is not set}"
: "${DOKPLOY_API_KEY:?DOKPLOY_API_KEY is not set}"
app_id="${!env_name:-}"
[ -n "$app_id" ] || die "$env_name is not set"
base="${DOKPLOY_URL%/}"
repo="$ECR_PREFIX/$app"

# Reads one field from JSON on stdin: json_field <dotted.path>; empty when missing.
json_field() {
  node -e '
    let s = ""
    process.stdin.on("data", (d) => (s += d)).on("end", () => {
      let v = JSON.parse(s || "{}")
      for (const k of process.argv[1].split(".")) v = v == null ? undefined : v[k]
      process.stdout.write(v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v))
    })' "$1"
}

dokploy() { # dokploy <GET|POST> <procedure> [json body]
  local method="$1" path="$2" body="${3:-}"
  # The token goes in through a file descriptor, never on the command line (ps would show it).
  local args=(-sS --fail-with-body -X "$method" -H @<(printf 'x-api-key: %s
' "$DOKPLOY_API_KEY"))
  if [ -n "$body" ]; then
    args+=(-H 'content-type: application/json' --data "$body")
  fi
  curl "${args[@]}" "$base/api/$path"
}

# 1. What is live now.
info="$(dokploy GET "application.one?applicationId=$app_id")" || die "could not read the $app application from Dokploy"
image="$(printf '%s' "$info" | json_field dockerImage)"
[ -n "$image" ] || die "the $app application has no docker image set"
current="${image##*:}"
[ "$current" != "$image" ] || die "the live image $image has no tag"

# 2. The newest images in ECR, newest first, one line per image: its release tags (the git sha),
#    space-separated. :buildcache is pushed on every build, so --last counts it; ask for a few
#    more than you need.
tags="$(aws ecr describe-images --region "$AWS_REGION" --repository-name "$repo" \
  --query "reverse(sort_by(imageDetails,&imagePushedAt))[:$last].imageTags" --output json)" ||
  die "could not list $repo in ECR"
images="$(printf '%s' "$tags" | node -e '
  let s = ""
  process.stdin.on("data", (d) => (s += d)).on("end", () => {
    for (const t of JSON.parse(s || "[]")) {
      // Moving tags (latest, dev-latest) and the BuildKit layer cache are never a release.
      const named = (t ?? []).filter((x) => x !== "buildcache" && !/(^|-)latest$/.test(x))
      if (named.length) console.log(named.join(" "))
    }
  })')"

echo "App:        $app ($app_id)"
echo "Live image: $image"
echo "Recent ECR tags in $repo, newest first:"
printf '%s\n' "$images" | sed 's/^/  /'

# 3. The target: --to, or the image pushed just before the live one.
if [ -n "$to" ]; then
  printf '%s\n' "$images" | tr ' ' '\n' | grep -qx -- "$to" ||
    aws ecr describe-images --region "$AWS_REGION" --repository-name "$repo" \
      --image-ids "imageTag=$to" --query 'imageDetails[0].imagePushedAt' --output text >/dev/null 2>&1 ||
    die "tag $to is not in $repo"
  target="$to"
else
  target="$(printf '%s\n' "$images" | awk -v cur="$current" '
    found { split($0, t, " "); print t[1]; exit }
    { for (i = 1; i <= NF; i++) if ($i == cur) found = 1 }')"
  [ -n "$target" ] ||
    die "the live tag $current is not among the last $last images (or it is the oldest); pass --to <tag> or a bigger --last"
fi
[ "$target" != "$current" ] || die "$app already runs $target"

new_image="$ECR_REGISTRY/$repo:$target"
echo
echo "Plan:"
echo "  1. Dokploy application.saveDockerProvider: $image"
echo "                                          -> $new_image"
echo "  2. Dokploy application.deploy (\"Rollback to ${target:0:12}\")"
echo "  3. SSM /vextro/deploy/last-sha/$app = $target (the next build rebuilds $app from there)"
if [ "$app" = worker ]; then
  echo "  Note: the worker runs migrations. Rolling it back does not undo a migration."
fi

if [ "$apply" != true ]; then
  echo
  echo "Dry run: nothing changed. Run again with --apply to roll back."
  exit 0
fi

# 4. Apply. No registry login is stored: the server pulls from ECR with its instance role
#    (see deploy-dokploy.mjs), so the registry fields stay empty here too.
started="$(date +%s)"
dokploy POST application.saveDockerProvider \
  "{\"applicationId\":\"$app_id\",\"dockerImage\":\"$new_image\",\"registryUrl\":null,\"username\":null,\"password\":null}" >/dev/null ||
  die "could not set the image"
dokploy POST application.deploy \
  "{\"applicationId\":\"$app_id\",\"title\":\"Rollback to ${target:0:12}\"}" >/dev/null ||
  die "the image is set to $new_image but the deploy did not start; redeploy $app in Dokploy"
aws ssm put-parameter --region "$AWS_REGION" --name "/vextro/deploy/last-sha/$app" \
  --value "$target" --type String --overwrite >/dev/null ||
  echo "rollback: warning: could not update /vextro/deploy/last-sha/$app" >&2
echo "Deploy started."

if [ "$wait" != true ]; then
  echo "Not waiting (--no-wait). Watch it in Dokploy → $app → Deployments."
  exit 0
fi

# 5. Wait for the newest deployment started after us to finish.
deadline=$((started + TIMEOUT_MIN * 60))
while :; do
  [ "$(date +%s)" -le "$deadline" ] || die "timed out after $TIMEOUT_MIN min; check Dokploy → $app → Deployments"
  sleep 10
  # shellcheck disable=SC2016 # a JavaScript template string, not a shell expansion
  status="$(dokploy GET "application.one?applicationId=$app_id" | node -e '
    let s = ""
    process.stdin.on("data", (d) => (s += d)).on("end", () => {
      const info = JSON.parse(s || "{}")
      const since = (Number(process.argv[1]) - 5) * 1000
      const latest = (info.deployments ?? [])
        .filter((d) => new Date(d.createdAt).getTime() >= since)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
      const app = info.applicationStatus === "error" ? "error" : "ok"
      process.stdout.write(`${latest?.status ?? "pending"} ${app}`)
    })' "$started")" || continue
  case "$status" in
    "error "*) die "the Dokploy deployment failed; see Dokploy → $app → Deployments" ;;
    "done ok") break ;;
  esac
done
echo "Rolled $app back to $target."
