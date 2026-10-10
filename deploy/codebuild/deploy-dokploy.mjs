// Rolls built images out through the Dokploy API, one app at a time (worker first because it
// runs migrations). Stops at the first failure. Usage: node deploy-dokploy.mjs "worker admin"
// Env: DOKPLOY_URL, DOKPLOY_API_KEY, DOKPLOY_APP_ID_<APP>, ECR_REGISTRY, ECR_PREFIX, GIT_SHA;
// optional HEALTH_URL_<APP> (public health URL probed afterwards), DEPLOY_TIMEOUT_MIN (15).
import { execFileSync } from 'node:child_process'

const ORDER = ['worker', 'admin', 'storefront']
const requested = (process.argv[2] ?? '').split(/\s+/).filter(Boolean)
const apps = ORDER.filter((a) => requested.includes(a))
const env = process.env
const base = `${env.DOKPLOY_URL ?? ''}`.replace(/\/$/, '')
const timeoutMs = Number(env.DEPLOY_TIMEOUT_MIN ?? 15) * 60_000
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

for (const key of ['DOKPLOY_URL', 'DOKPLOY_API_KEY', 'ECR_REGISTRY', 'ECR_PREFIX', 'GIT_SHA']) {
  if (!env[key]) throw new Error(`${key} is not set`)
}

async function api(method, path, body) {
  const res = await fetch(`${base}/api/${path}`, {
    method,
    headers: { 'x-api-key': env.DOKPLOY_API_KEY, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok)
    throw new Error(`Dokploy ${path} -> ${res.status} ${(await res.text()).slice(0, 200)}`)
  const text = await res.text()
  return text ? JSON.parse(text) : {}
}

// ECR tokens last 12 h; refreshed on every deploy so the stored credential is never stale.
const ecrPassword = execFileSync('aws', ['ecr', 'get-login-password'], { encoding: 'utf8' }).trim()

async function deployApp(app) {
  const applicationId = env[`DOKPLOY_APP_ID_${app.toUpperCase()}`]
  if (!applicationId) throw new Error(`DOKPLOY_APP_ID_${app.toUpperCase()} is not set`)
  const image = `${env.ECR_REGISTRY}/${env.ECR_PREFIX}/${app}:${env.GIT_SHA}`

  await api('POST', 'application.saveDockerProvider', {
    applicationId,
    dockerImage: image,
    registryUrl: env.ECR_REGISTRY,
    username: 'AWS',
    password: ecrPassword,
  })
  const startedAt = Date.now()
  await api('POST', 'application.deploy', {
    applicationId,
    title: `CodeBuild ${env.GIT_SHA.slice(0, 7)}`,
  })

  // Wait for the newest deployment created after we started to finish.
  for (;;) {
    if (Date.now() > startedAt + timeoutMs)
      throw new Error(`${app}: timed out waiting for deployment`)
    await sleep(10_000)
    const info = await api('GET', `application.one?applicationId=${applicationId}`)
    const latest = (info.deployments ?? [])
      .filter((d) => new Date(d.createdAt).getTime() >= startedAt - 5_000)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
    if (latest?.status === 'error') throw new Error(`${app}: Dokploy deployment failed`)
    if (latest?.status === 'done' && info.applicationStatus !== 'error') break
  }

  const healthUrl = env[`HEALTH_URL_${app.toUpperCase()}`]
  if (healthUrl) {
    for (let i = 0; ; i++) {
      if (
        await fetch(healthUrl)
          .then((r) => r.ok)
          .catch(() => false)
      )
        break
      if (i >= 17) throw new Error(`${app}: ${healthUrl} never became healthy`)
      await sleep(10_000)
    }
  }

  // Remember what is live so the next build only rebuilds what changed.
  execFileSync('aws', [
    'ssm',
    'put-parameter',
    '--name',
    `/vextro/deploy/last-sha/${app}`,
    '--value',
    env.GIT_SHA,
    '--type',
    'String',
    '--overwrite',
  ])
}

const summary = []
try {
  for (const app of apps) {
    console.log(`==> deploying ${app}`)
    await deployApp(app)
    summary.push(`${app}: ok`)
  }
} catch (err) {
  summary.push(`FAILED: ${err.message}`)
  console.log(summary.join('\n'))
  process.exit(1)
}
console.log(`Deployed ${env.GIT_SHA.slice(0, 7)}\n${summary.join('\n')}`)
