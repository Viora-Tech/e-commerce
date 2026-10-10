# Production layout (Dokploy on Hetzner, apps on AWS Mumbai)

No secrets here: names, sizes and ids only. Env values live in Dokploy and are pasted by the owner.

## Servers

| Server | Where | Size | Runs |
| --- | --- | --- | --- |
| `viora-panel` | Hetzner Nuremberg, 128.140.66.227 | CX23 (2 shared vCPU x86, 4 GB) | Dokploy panel (`https://dokploy.vioratech.in`), Traefik, later Umami |
| `viora-tools` | Hetzner Nuremberg, 128.140.71.21 | CX23 | OpenMausBot |
| `vextro-app` | AWS ap-south-1c, Elastic IP 13.205.25.249 | t3a.medium (2 vCPU x86, 4 GB, unlimited credits), 40 GB gp3 encrypted | admin, storefront, worker, Postgres, Dragonfly |

Shoppers only touch `vextro-app`. Postgres and Dragonfly stay next to the apps (sub-millisecond);
nothing on the shopper path runs in the EU. If Hetzner is down, the store keeps working; only deploys
and internal tools pause.

Hardening on all three: ufw 22/80/443, fail2ban, key-only SSH, unattended security upgrades, 2 GB
swap (swappiness 10), Asia/Kolkata time. The panel's port 3000 is closed by a `DOCKER-USER` iptables
rule kept by `block-dokploy-3000.service` (ufw cannot block Docker-published ports). AWS security group
`vextro-app`: 80/443 public, 22 only from the panel and the owner.

## Dokploy

- Remote server `vextro-app` (SSH key `panel-to-servers`, user root).
- Project **Vextro**, environment `production`:

| Service | Image | Limits | Notes |
| --- | --- | --- | --- |
| postgres (`vextro-postgres-…`) | `postgres:17-alpine` | 1 GB (reserve 512 MB) | `shared_buffers=384MB`, `effective_cache_size=1GB`, `max_connections=40`, `work_mem=8MB`. Owner role `postgres`; the RLS `app` role (NOBYPASSRLS) is created at restore |
| dragonfly (`vextro-dragonfly-…`) | `dragonflydb/dragonfly:v1.40.2` | 384 MB | `--maxmemory=320mb --proactor_threads=1`, snapshots every 15 min to volume `vextro-dragonfly-data` |
| worker | ECR `vextro/worker:<sha>` | 384 MB | deploy first, runs migrations |
| admin | ECR `vextro/admin:<sha>` | 640 MB | build-arg `NEXT_PUBLIC_WORKER_URL` |
| storefront | ECR `vextro/storefront:<sha>` | 640 MB | |

Apps reach the database and cache by their Dokploy app names (shown on each service page) on the
`dokploy-network`: `DATABASE_URL`/`DATABASE_URL_OWNER` host = the postgres app name, `REDIS_URL` host =
the dragonfly app name, port 6379. Every other env key is the same as `deploy/env.production.example`.

## Images and deploys

Images are built off the server (CodeBuild x86, see `deploy/codebuild/`; or locally with Docker on an
x86 machine) and pushed to ECR `vextro/{worker,admin,storefront}`. The CodeBuild job reads the panel URL
and app ids from SSM `/vextro/deploy/*` and deploys worker → admin → storefront, one at a time. Auto
deploy is off on every app.

## Moving data from the old server

At night: stop the old apps, `pg_dumpall --roles-only` + `pg_dump -Fc` from the old Postgres, restore
into the new one, start worker (migrations) → admin → storefront, add the domains, switch the DNS A
records to 13.205.25.249, smoke test. Keep the old server stopped for a week, then delete it.
