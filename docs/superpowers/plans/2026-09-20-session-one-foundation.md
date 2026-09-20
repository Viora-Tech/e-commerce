# Session One Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the monorepo, a multi-tenant Postgres schema enforced by row-level security, a place-order workflow with compensation, provider interfaces, and a worker process. No UI.

**Architecture:** Bun workspaces + Turborepo. `packages/db` owns the Drizzle schema, migrations, and the `withStore` transaction helper that sets `app.store_id` for RLS. `packages/core` owns provider interfaces, typed errors, a generic workflow runner, and the place-order workflow. `apps/worker` is a Hono process on Bun with one BullMQ queue on Dragonfly. `core` and `db` never import from `features` or `apps`.

**Tech Stack:** Bun 1.3, Node 22, TypeScript 5.9, Drizzle ORM 0.45 + postgres-js, Postgres 17, Dragonfly, BullMQ 5, Hono 4, Zod 4, Vitest 4, Biome 2, Turborepo 2.

**Spec:** `docs/superpowers/specs/2026-09-20-session-one-foundation-design.md`

## Global Constraints

- Money is integer paise. Ids are UUID v7, generated in app code with `uuid` v7.
- Every tenant-owned table has `store_id uuid not null references store(id)`, RLS enabled and forced, policy `store_isolation` using `store_id = nullif(current_setting('app.store_id', true), '')::uuid`.
- Runtime role is `app` (LOGIN, NOBYPASSRLS, not table owner). Migrations run as `postgres`.
- `core` and `db` never import from `features` or `apps`.
- Core throws typed errors extending `CommerceError { code, storeId?, cause? }`. No HTTP concerns in core.
- Dragonfly runs with `--cluster_mode=emulated --lock_on_hashtags`; queue names use `{...}` hashtags.
- Tests that need Postgres use database `commerce_test`, reset per test file, files run serially.
- Shell is Git Bash on Windows; use forward slashes and `bun`/`bunx`.

---

## File Structure

```
.gitignore
.env.example
.env.test
package.json                      bun workspaces root, scripts
turbo.json
biome.json
docker-compose.yml
docker/postgres/init.sql          creates role `app` and database `commerce_test`
packages/config/
  package.json
  tsconfig.base.json
  src/env.ts                      Zod env schema + loadEnv
  src/env.test.ts
  vitest.config.ts
packages/db/
  package.json
  tsconfig.json
  drizzle.config.ts
  vitest.config.ts
  src/index.ts                    re-exports
  src/schema.ts                   all tables
  src/client.ts                   createDb(url), ownerDb/appDb factories
  src/with-store.ts               withStore, withoutStore
  src/migrate.ts                  runMigrations(url)
  drizzle/0000_*.sql              generated tables
  drizzle/0001_rls.sql            apply_store_rls() function + call
  test/global-setup.ts            migrate commerce_test
  test/reset.ts                   truncate all tables
  test/rls-coverage.test.ts
  test/rls-isolation.test.ts
packages/core/
  package.json
  tsconfig.json
  vitest.config.ts
  src/index.ts
  src/errors.ts
  src/context.ts                  StoreContext
  src/providers/payment.ts        PaymentProvider + FakePaymentProvider
  src/providers/fulfilment.ts
  src/providers/notification.ts
  src/workflow/run.ts             runWorkflow
  src/workflow/run.test.ts
  src/order/place-order.ts
  src/order/place-order.test.ts
  test/global-setup.ts
apps/worker/
  package.json
  tsconfig.json
  src/index.ts                    Hono app, /health, heartbeat queue
  src/queues.ts
packages/features/README.md       convention only
```

---

### Task 1: Monorepo scaffold and infrastructure

**Files:**
- Create: `package.json`, `turbo.json`, `biome.json`, `.gitignore`, `.env.example`, `.env.test`, `docker-compose.yml`, `docker/postgres/init.sql`, `packages/config/package.json`, `packages/config/tsconfig.base.json`, `packages/features/README.md`

**Interfaces:**
- Produces: workspace packages `@commerce/config`, `@commerce/db`, `@commerce/core`, `@commerce/worker`; `packages/config/tsconfig.base.json` extended by every package; env vars `DATABASE_URL`, `DATABASE_URL_OWNER`, `REDIS_URL`, `WORKER_PORT`.

- [ ] **Step 1: Root package.json**

```json
{
  "name": "commerce",
  "private": true,
  "packageManager": "bun@1.3.11",
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "typecheck": "turbo run typecheck",
    "db:generate": "bun run --cwd packages/db generate",
    "db:migrate": "bun run --cwd packages/db migrate",
    "infra:up": "docker compose up -d",
    "infra:down": "docker compose down"
  },
  "devDependencies": {
    "@biomejs/biome": "2.5.14",
    "turbo": "^2.11.2",
    "typescript": "~5.9.3"
  }
}
```

- [ ] **Step 2: turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "test": { "dependsOn": ["^build"], "cache": false },
    "typecheck": { "dependsOn": ["^build"] },
    "dev": { "cache": false, "persistent": true }
  }
}
```

- [ ] **Step 3: biome.json**

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.14/schema.json",
  "files": { "includes": ["**", "!**/node_modules", "!**/dist", "!**/drizzle/**/*.sql", "!**/.turbo"] },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "javascript": { "formatter": { "quoteStyle": "single", "semicolons": "asNeeded", "trailingCommas": "all" } },
  "linter": { "enabled": true, "rules": { "recommended": true } }
}
```

- [ ] **Step 4: .gitignore, .env.example, .env.test**

`.gitignore`:
```
node_modules
dist
.turbo
.env
.env.local
*.tsbuildinfo
```

`.env.example`:
```
DATABASE_URL=postgres://app:app@localhost:5432/commerce
DATABASE_URL_OWNER=postgres://postgres:postgres@localhost:5432/commerce
REDIS_URL=redis://localhost:6379
WORKER_PORT=4100
```

`.env.test` (committed; test database only):
```
DATABASE_URL=postgres://app:app@localhost:5432/commerce_test
DATABASE_URL_OWNER=postgres://postgres:postgres@localhost:5432/commerce_test
REDIS_URL=redis://localhost:6379
WORKER_PORT=4101
```

- [ ] **Step 5: docker-compose.yml and init.sql**

`docker-compose.yml`:
```yaml
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: commerce
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 10
  dragonfly:
    image: docker.dragonflydb.io/dragonflydb/dragonfly:latest
    command: ["dragonfly", "--cluster_mode=emulated", "--lock_on_hashtags", "--proactor_threads=1"]
    ports:
      - "6379:6379"
    ulimits:
      memlock: -1
volumes:
  pgdata:
```

`docker/postgres/init.sql`:
```sql
-- Runtime role: cannot bypass RLS, does not own tables.
CREATE ROLE app LOGIN PASSWORD 'app' NOBYPASSRLS;
GRANT CONNECT ON DATABASE commerce TO app;
CREATE DATABASE commerce_test;
GRANT CONNECT ON DATABASE commerce_test TO app;
\connect commerce
GRANT USAGE ON SCHEMA public TO app;
\connect commerce_test
GRANT USAGE ON SCHEMA public TO app;
```

- [ ] **Step 6: packages/config**

`packages/config/package.json`:
```json
{
  "name": "@commerce/config",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/env.ts", "./tsconfig.base.json": "./tsconfig.base.json" },
  "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit" },
  "dependencies": { "zod": "^4.6.5" },
  "devDependencies": { "vitest": "^4.1.11", "@types/node": "^22.20.4", "typescript": "~5.9.3" }
}
```

`packages/config/tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2023"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "types": ["node"]
  }
}
```

`packages/config/tsconfig.json`:
```json
{ "extends": "./tsconfig.base.json", "include": ["src"] }
```

- [ ] **Step 7: packages/features/README.md**

```markdown
# Features

Each feature is one package: `packages/features/<name>` with a single public
entry `src/index.ts`. A feature may import `@commerce/core` and `@commerce/db`.
`core` and `db` never import a feature. Apps wire features in one `features.ts`
file each. When the plugin system arrives, that file becomes the registry and
each package gains a manifest. Nothing else moves.

Empty in session one.
```

- [ ] **Step 8: Install and verify**

Run:
```bash
cd "E:/Dev/my e-commerce" && bun install && bunx biome check . && docker compose up -d --wait && docker compose exec -T postgres psql -U postgres -d commerce_test -c "select rolname, rolbypassrls from pg_roles where rolname='app'"
```
Expected: install ok, biome reports no errors, psql prints `app | f`.

If the postgres volume already existed from an earlier run, init.sql does not rerun: `docker compose down -v && docker compose up -d`.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "chore: scaffold monorepo, compose infra, config package"
```

---

### Task 2: Env schema

**Files:**
- Create: `packages/config/src/env.ts`, `packages/config/src/env.test.ts`, `packages/config/vitest.config.ts`

**Interfaces:**
- Produces: `loadEnv(source: Record<string, string | undefined>): Env` where `Env = { DATABASE_URL: string; DATABASE_URL_OWNER: string; REDIS_URL: string; WORKER_PORT: number }`. Throws `Error` with message starting `Invalid environment:` listing missing keys.

- [ ] **Step 1: Failing test**

`packages/config/src/env.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { loadEnv } from './env'

const valid = {
  DATABASE_URL: 'postgres://app:app@localhost:5432/commerce',
  DATABASE_URL_OWNER: 'postgres://postgres:postgres@localhost:5432/commerce',
  REDIS_URL: 'redis://localhost:6379',
  WORKER_PORT: '4100',
}

describe('loadEnv', () => {
  it('parses a valid environment and coerces the port', () => {
    const env = loadEnv(valid)
    expect(env.WORKER_PORT).toBe(4100)
    expect(env.REDIS_URL).toBe('redis://localhost:6379')
  })

  it('fails fast naming the missing key', () => {
    const { DATABASE_URL: _drop, ...rest } = valid
    expect(() => loadEnv(rest)).toThrow(/Invalid environment:.*DATABASE_URL/)
  })
})
```

`packages/config/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { include: ['src/**/*.test.ts'] } })
```

- [ ] **Step 2: Run, expect failure**

Run: `cd "E:/Dev/my e-commerce/packages/config" && bunx vitest run`
Expected: FAIL, cannot find module './env'.

- [ ] **Step 3: Implement**

`packages/config/src/env.ts`:
```ts
import { z } from 'zod'

const schema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_URL_OWNER: z.string().url(),
  REDIS_URL: z.string().url(),
  WORKER_PORT: z.coerce.number().int().min(1).max(65535).default(4100),
})

export type Env = z.infer<typeof schema>

export function loadEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source)
  if (!result.success) {
    const keys = result.error.issues.map((i) => i.path.join('.')).join(', ')
    throw new Error(`Invalid environment: ${keys}`)
  }
  return result.data
}
```

- [ ] **Step 4: Run, expect pass**

Run: `cd "E:/Dev/my e-commerce/packages/config" && bunx vitest run && bunx tsc --noEmit`
Expected: 2 passed, tsc silent.

- [ ] **Step 5: Commit**

```bash
git add packages/config && git commit -m "feat(config): zod env schema with fail-fast loadEnv"
```

---

### Task 3: Database schema, client, migrations

**Files:**
- Create: `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/drizzle.config.ts`, `packages/db/src/schema.ts`, `packages/db/src/client.ts`, `packages/db/src/migrate.ts`, `packages/db/src/index.ts`, `packages/db/drizzle/0000_*.sql` (generated), `packages/db/drizzle/0001_rls.sql`

**Interfaces:**
- Produces: table objects `store, product, variant, inventoryLevel, customer, cart, cartLine, order, orderLine, payment` from `@commerce/db`; `createDb(url: string): Db` where `Db = PostgresJsDatabase<typeof schema>`; `runMigrations(ownerUrl: string): Promise<void>`; `newId(): string` (UUID v7).
- Column names in camelCase in TS, snake_case in SQL.

- [ ] **Step 1: Package files**

`packages/db/package.json`:
```json
{
  "name": "@commerce/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts", "./test": "./test/reset.ts" },
  "scripts": {
    "generate": "drizzle-kit generate",
    "migrate": "bun run src/migrate.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@commerce/config": "workspace:*",
    "drizzle-orm": "^0.45.2",
    "postgres": "^3.4.9",
    "uuid": "^14.0.2"
  },
  "devDependencies": {
    "drizzle-kit": "^0.31.10",
    "dotenv": "^18.0.1",
    "vitest": "^4.1.11",
    "@types/node": "^22.20.4",
    "typescript": "~5.9.3"
  }
}
```

`packages/db/tsconfig.json`:
```json
{ "extends": "@commerce/config/tsconfig.base.json", "include": ["src", "test", "drizzle.config.ts"] }
```

`packages/db/drizzle.config.ts`:
```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  casing: 'snake_case',
})
```

- [ ] **Step 2: Schema**

`packages/db/src/schema.ts`:
```ts
import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'

export const newId = (): string => uuidv7()

const id = () => uuid('id').primaryKey().$defaultFn(newId)
const storeId = () =>
  uuid('store_id')
    .notNull()
    .references(() => store.id)
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()

export const store = pgTable('store', {
  id: id(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  currency: text('currency').notNull().default('INR'),
  nextOrderNumber: integer('next_order_number').notNull().default(1),
  createdAt: createdAt(),
})

export const product = pgTable('product', {
  id: id(),
  storeId: storeId(),
  handle: text('handle').notNull(),
  title: text('title').notNull(),
  status: text('status', { enum: ['draft', 'active', 'archived'] }).notNull().default('draft'),
  createdAt: createdAt(),
})

export const variant = pgTable('variant', {
  id: id(),
  storeId: storeId(),
  productId: uuid('product_id')
    .notNull()
    .references(() => product.id),
  sku: text('sku'),
  title: text('title').notNull(),
  pricePaise: integer('price_paise').notNull(),
  mrpPaise: integer('mrp_paise'),
})

export const inventoryLevel = pgTable('inventory_level', {
  id: id(),
  storeId: storeId(),
  variantId: uuid('variant_id')
    .notNull()
    .references(() => variant.id)
    .unique(),
  onHand: integer('on_hand').notNull().default(0),
  reserved: integer('reserved').notNull().default(0),
})

export const customer = pgTable('customer', {
  id: id(),
  storeId: storeId(),
  email: text('email'),
  phone: text('phone'),
  name: text('name'),
})

export const cart = pgTable('cart', {
  id: id(),
  storeId: storeId(),
  customerId: uuid('customer_id').references(() => customer.id),
  status: text('status', { enum: ['open', 'converted', 'abandoned'] }).notNull().default('open'),
  createdAt: createdAt(),
})

export const cartLine = pgTable('cart_line', {
  id: id(),
  storeId: storeId(),
  cartId: uuid('cart_id')
    .notNull()
    .references(() => cart.id),
  variantId: uuid('variant_id')
    .notNull()
    .references(() => variant.id),
  quantity: integer('quantity').notNull(),
  unitPricePaise: integer('unit_price_paise').notNull(),
})

export const order = pgTable('order', {
  id: id(),
  storeId: storeId(),
  number: integer('number').notNull(),
  customerId: uuid('customer_id').references(() => customer.id),
  status: text('status', { enum: ['placed', 'paid', 'fulfilled', 'delivered', 'cancelled'] })
    .notNull()
    .default('placed'),
  subtotalPaise: integer('subtotal_paise').notNull(),
  totalPaise: integer('total_paise').notNull(),
  placedAt: timestamp('placed_at', { withTimezone: true }).notNull().defaultNow(),
})

export const orderLine = pgTable('order_line', {
  id: id(),
  storeId: storeId(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => order.id),
  variantId: uuid('variant_id')
    .notNull()
    .references(() => variant.id),
  quantity: integer('quantity').notNull(),
  unitPricePaise: integer('unit_price_paise').notNull(),
})

export const payment = pgTable('payment', {
  id: id(),
  storeId: storeId(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => order.id),
  provider: text('provider').notNull(),
  providerRef: text('provider_ref').notNull(),
  status: text('status', { enum: ['pending', 'captured', 'refunded', 'failed'] }).notNull(),
  amountPaise: integer('amount_paise').notNull(),
})
```

- [ ] **Step 3: Client, migrate, index**

`packages/db/src/client.ts`:
```ts
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export type Db = PostgresJsDatabase<typeof schema>

export function createDb(url: string): Db {
  const sql = postgres(url, { max: 10 })
  return drizzle(sql, { schema, casing: 'snake_case' })
}
```

`packages/db/src/migrate.ts`:
```ts
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

export async function runMigrations(ownerUrl: string): Promise<void> {
  const sql = postgres(ownerUrl, { max: 1 })
  try {
    const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url))
    await migrate(drizzle(sql), { migrationsFolder })
  } finally {
    await sql.end()
  }
}

if ((import.meta as { main?: boolean }).main) {
  const url = process.env.DATABASE_URL_OWNER
  if (!url) throw new Error('DATABASE_URL_OWNER is required')
  await runMigrations(url)
  console.log('migrations applied')
}
```

`packages/db/src/index.ts`:
```ts
export * from './schema'
export { createDb, type Db } from './client'
export { runMigrations } from './migrate'
export { withStore, withoutStore, type StoreTx } from './with-store'
```

(`with-store.ts` is written in Task 4. Until then, comment out its export line so `tsc` passes, and restore it in Task 4.)

- [ ] **Step 4: Generate the table migration**

Run:
```bash
cd "E:/Dev/my e-commerce" && bun install && cd packages/db && bunx drizzle-kit generate --name tables && ls drizzle
```
Expected: `drizzle/0000_tables.sql` and `drizzle/meta/` exist. Open the SQL and confirm all ten tables and `store_id` foreign keys are present.

- [ ] **Step 5: Custom RLS migration**

Run: `cd "E:/Dev/my e-commerce/packages/db" && bunx drizzle-kit generate --custom --name rls`
Expected: empty `drizzle/0001_rls.sql` created and registered in `drizzle/meta/_journal.json`.

Write `packages/db/drizzle/0001_rls.sql`:
```sql
-- Grants and row-level security for the runtime role `app`.
-- Re-run `select apply_store_rls();` in every later migration that adds tables.

CREATE OR REPLACE FUNCTION apply_store_rls() RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  t record;
BEGIN
  GRANT USAGE ON SCHEMA public TO app;

  -- store: the tenant row itself, isolated by id.
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE store TO app;
  ALTER TABLE store ENABLE ROW LEVEL SECURITY;
  ALTER TABLE store FORCE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS store_isolation ON store;
  CREATE POLICY store_isolation ON store
    USING (id = nullif(current_setting('app.store_id', true), '')::uuid)
    WITH CHECK (id = nullif(current_setting('app.store_id', true), '')::uuid);

  -- every table with a store_id column.
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.column_name = 'store_id'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO app', t.table_name);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t.table_name);
    EXECUTE format('DROP POLICY IF EXISTS store_isolation ON %I', t.table_name);
    EXECUTE format(
      'CREATE POLICY store_isolation ON %I USING (store_id = nullif(current_setting(''app.store_id'', true), '''')::uuid) WITH CHECK (store_id = nullif(current_setting(''app.store_id'', true), '''')::uuid)',
      t.table_name
    );
  END LOOP;

  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app;
END;
$$;

SELECT apply_store_rls();
```

- [ ] **Step 6: Apply to both databases and inspect**

Run:
```bash
cd "E:/Dev/my e-commerce/packages/db" && DATABASE_URL_OWNER=postgres://postgres:postgres@localhost:5432/commerce bun run migrate && DATABASE_URL_OWNER=postgres://postgres:postgres@localhost:5432/commerce_test bun run migrate && docker compose -f ../../docker-compose.yml exec -T postgres psql -U postgres -d commerce_test -c "select relname, relrowsecurity, relforcerowsecurity from pg_class where relname in ('store','product','order') order by 1"
```
Expected: `migrations applied` twice, then three rows all `t | t`.

- [ ] **Step 7: Typecheck and commit**

Run: `cd "E:/Dev/my e-commerce/packages/db" && bunx tsc --noEmit`
Expected: silent.

```bash
git add packages/db bun.lock && git commit -m "feat(db): drizzle schema, migrations, RLS via apply_store_rls()"
```

---

### Task 4: withStore transaction helper and RLS tests

**Files:**
- Create: `packages/db/src/with-store.ts`, `packages/db/vitest.config.ts`, `packages/db/test/global-setup.ts`, `packages/db/test/reset.ts`, `packages/db/test/rls-coverage.test.ts`, `packages/db/test/rls-isolation.test.ts`
- Modify: `packages/db/src/index.ts` (restore the with-store export)

**Interfaces:**
- Produces: `withStore<T>(db: Db, storeId: string, fn: (tx: StoreTx) => Promise<T>): Promise<T>`; `withoutStore<T>(db: Db, fn: (tx: StoreTx) => Promise<T>): Promise<T>`; `StoreTx` = Drizzle transaction type; `resetDb(ownerDb: Db): Promise<void>` from `@commerce/db/test`.

- [ ] **Step 1: Test infrastructure**

`packages/db/vitest.config.ts`:
```ts
import { config } from 'dotenv'
import { defineConfig } from 'vitest/config'

config({ path: '../../.env.test' })

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 20000,
  },
})
```

`packages/db/test/global-setup.ts`:
```ts
import { runMigrations } from '../src/migrate'

export default async function setup(): Promise<void> {
  const url = process.env.DATABASE_URL_OWNER
  if (!url) throw new Error('DATABASE_URL_OWNER missing; is .env.test loaded?')
  await runMigrations(url)
}
```

`packages/db/test/reset.ts`:
```ts
import { sql } from 'drizzle-orm'
import type { Db } from '../src/client'

/** Truncate every public table except the migrations journal. Owner connection only. */
export async function resetDb(ownerDb: Db): Promise<void> {
  const rows = await ownerDb.execute<{ table_name: string }>(sql`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
  `)
  const names = rows.map((r) => `"${r.table_name}"`).join(', ')
  if (names.length === 0) return
  await ownerDb.execute(sql.raw(`truncate table ${names} restart identity cascade`))
}
```

- [ ] **Step 2: Failing tests**

`packages/db/test/rls-coverage.test.ts`:
```ts
import { sql } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { createDb } from '../src/client'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)

afterAll(async () => {
  await owner.$client.end()
})

describe('RLS coverage', () => {
  it('every table with store_id has RLS enabled, forced, and the store_isolation policy', async () => {
    const rows = await owner.execute<{
      table_name: string
      rls: boolean
      forced: boolean
      has_policy: boolean
    }>(sql`
      select c.table_name,
             cl.relrowsecurity as rls,
             cl.relforcerowsecurity as forced,
             exists (
               select 1 from pg_policies p
               where p.schemaname = 'public' and p.tablename = c.table_name
                 and p.policyname = 'store_isolation'
             ) as has_policy
      from information_schema.columns c
      join pg_class cl on cl.relname = c.table_name
      join pg_namespace n on n.oid = cl.relnamespace and n.nspname = 'public'
      where c.table_schema = 'public' and c.column_name = 'store_id'
      order by 1
    `)
    expect(rows.length).toBeGreaterThan(0)
    const bad = rows.filter((r) => !(r.rls && r.forced && r.has_policy)).map((r) => r.table_name)
    expect(bad, 'run select apply_store_rls() in the migration that added these').toEqual([])
  })

  it('the store table itself is isolated by id', async () => {
    const [row] = await owner.execute<{ rls: boolean; forced: boolean }>(sql`
      select relrowsecurity as rls, relforcerowsecurity as forced from pg_class where relname = 'store'
    `)
    expect(row).toEqual({ rls: true, forced: true })
  })

  it('the app role cannot bypass RLS', async () => {
    const [row] = await owner.execute<{ rolbypassrls: boolean; rolsuper: boolean }>(sql`
      select rolbypassrls, rolsuper from pg_roles where rolname = 'app'
    `)
    expect(row).toEqual({ rolbypassrls: false, rolsuper: false })
  })
})
```

`packages/db/test/rls-isolation.test.ts`:
```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createDb } from '../src/client'
import { product, store } from '../src/schema'
import { withStore, withoutStore } from '../src/with-store'
import { resetDb } from './reset'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function seedTwoStores() {
  const [a, b] = await owner
    .insert(store)
    .values([
      { slug: 'a', name: 'Store A' },
      { slug: 'b', name: 'Store B' },
    ])
    .returning()
  if (!a || !b) throw new Error('seed failed')
  await owner.insert(product).values([
    { storeId: a.id, handle: 'pa', title: 'A product' },
    { storeId: b.id, handle: 'pb', title: 'B product' },
  ])
  return { a, b }
}

describe('store isolation', () => {
  it('each store context sees only its own rows', async () => {
    const { a, b } = await seedTwoStores()
    const seenByA = await withStore(app, a.id, (tx) => tx.select().from(product))
    const seenByB = await withStore(app, b.id, (tx) => tx.select().from(product))
    expect(seenByA.map((p) => p.handle)).toEqual(['pa'])
    expect(seenByB.map((p) => p.handle)).toEqual(['pb'])
  })

  it('the app role sees nothing without a store context', async () => {
    await seedTwoStores()
    const rows = await app.select().from(product)
    expect(rows).toEqual([])
  })

  it('a store cannot insert a row for another store', async () => {
    const { a, b } = await seedTwoStores()
    await expect(
      withStore(app, a.id, (tx) =>
        tx.insert(product).values({ storeId: b.id, handle: 'smuggled', title: 'x' }),
      ),
    ).rejects.toThrow(/row-level security/)
  })

  it('withoutStore on the owner connection sees every row', async () => {
    await seedTwoStores()
    const rows = await withoutStore(owner, (tx) => tx.select().from(product))
    expect(rows).toHaveLength(2)
  })
})
```

- [ ] **Step 3: Run, expect failure**

Run: `cd "E:/Dev/my e-commerce/packages/db" && bunx vitest run`
Expected: coverage tests pass (migration already applied), isolation tests FAIL with cannot find module '../src/with-store'.

- [ ] **Step 4: Implement withStore**

`packages/db/src/with-store.ts`:
```ts
import { sql } from 'drizzle-orm'
import type { Db } from './client'

export type StoreTx = Parameters<Parameters<Db['transaction']>[0]>[0]

/**
 * Run `fn` inside a transaction scoped to one store. RLS policies read
 * `app.store_id`, so every query in `fn` sees only that store's rows.
 */
export async function withStore<T>(
  db: Db,
  storeId: string,
  fn: (tx: StoreTx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.store_id', ${storeId}, true)`)
    return fn(tx)
  })
}

/**
 * Deliberately unscoped transaction. Only meaningful on an owner connection
 * (migrations, cross-store admin jobs). On the app connection it sees nothing.
 * Named so it stands out in review.
 */
export async function withoutStore<T>(db: Db, fn: (tx: StoreTx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => fn(tx))
}
```

Restore in `packages/db/src/index.ts`:
```ts
export { withStore, withoutStore, type StoreTx } from './with-store'
```

- [ ] **Step 5: Run, expect pass**

Run: `cd "E:/Dev/my e-commerce/packages/db" && bunx vitest run && bunx tsc --noEmit`
Expected: 7 passed, tsc silent.

If the "cannot insert for another store" test fails with a foreign-key error instead of an RLS error: the `store_id` FK check runs before the policy on some Postgres versions. Accept either by changing the matcher to `/row-level security|violates/`.

- [ ] **Step 6: Commit**

```bash
git add packages/db && git commit -m "feat(db): withStore/withoutStore and RLS coverage + isolation tests"
```

---

### Task 5: Core errors, context, providers, workflow runner

**Files:**
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/vitest.config.ts`, `packages/core/src/index.ts`, `packages/core/src/errors.ts`, `packages/core/src/context.ts`, `packages/core/src/providers/payment.ts`, `packages/core/src/providers/fulfilment.ts`, `packages/core/src/providers/notification.ts`, `packages/core/src/workflow/run.ts`, `packages/core/src/workflow/run.test.ts`

**Interfaces:**
- Produces:
  - `class CommerceError extends Error { code: string; storeId?: string; cause?: unknown }`, `OutOfStock`, `CartNotOpen`, `PaymentFailed`, `CartEmpty`.
  - `type StoreContext = { storeId: string; tx: StoreTx }`.
  - `PaymentProvider`, `FulfilmentProvider`, `NotificationProvider` as in spec; `FakePaymentProvider` with constructor `{ mode: 'capture' | 'fail' }` and public `calls: string[]`.
  - `runWorkflow<S>(initial: S, steps: WorkflowStep<S>[], log?: { error(msg: string, err: unknown): void }): Promise<S>`.

- [ ] **Step 1: Package files**

`packages/core/package.json`:
```json
{
  "name": "@commerce/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit" },
  "dependencies": {
    "@commerce/db": "workspace:*",
    "drizzle-orm": "^0.45.2"
  },
  "devDependencies": {
    "dotenv": "^18.0.1",
    "vitest": "^4.1.11",
    "@types/node": "^22.20.4",
    "typescript": "~5.9.3"
  }
}
```

`packages/core/tsconfig.json`:
```json
{ "extends": "@commerce/config/tsconfig.base.json", "include": ["src", "test"] }
```

`packages/core/vitest.config.ts`:
```ts
import { config } from 'dotenv'
import { defineConfig } from 'vitest/config'

config({ path: '../../.env.test' })

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 20000,
  },
})
```

`packages/core/test/global-setup.ts`:
```ts
import { runMigrations } from '@commerce/db'

export default async function setup(): Promise<void> {
  const url = process.env.DATABASE_URL_OWNER
  if (!url) throw new Error('DATABASE_URL_OWNER missing; is .env.test loaded?')
  await runMigrations(url)
}
```

- [ ] **Step 2: Errors, context, providers**

`packages/core/src/errors.ts`:
```ts
export class CommerceError extends Error {
  readonly code: string
  readonly storeId: string | undefined
  override readonly cause: unknown

  constructor(code: string, message: string, opts: { storeId?: string; cause?: unknown } = {}) {
    super(message)
    this.name = new.target.name
    this.code = code
    this.storeId = opts.storeId
    this.cause = opts.cause
  }
}

export class OutOfStock extends CommerceError {
  constructor(variantId: string, storeId?: string) {
    super('OUT_OF_STOCK', `Variant ${variantId} has insufficient stock`, { storeId })
  }
}

export class CartNotOpen extends CommerceError {
  constructor(cartId: string, storeId?: string) {
    super('CART_NOT_OPEN', `Cart ${cartId} is not open`, { storeId })
  }
}

export class CartEmpty extends CommerceError {
  constructor(cartId: string, storeId?: string) {
    super('CART_EMPTY', `Cart ${cartId} has no lines`, { storeId })
  }
}

export class PaymentFailed extends CommerceError {
  constructor(provider: string, cause?: unknown, storeId?: string) {
    super('PAYMENT_FAILED', `Payment via ${provider} failed`, { storeId, cause })
  }
}
```

`packages/core/src/context.ts`:
```ts
import type { StoreTx } from '@commerce/db'

export type StoreContext = {
  storeId: string
  tx: StoreTx
}
```

`packages/core/src/providers/payment.ts`:
```ts
import type { StoreContext } from '../context'

export type PaymentStatus = 'pending' | 'captured'

export interface PaymentProvider {
  readonly id: string
  createPayment(
    ctx: StoreContext,
    input: { orderId: string; amountPaise: number; customer: { email?: string; phone?: string } },
  ): Promise<{ providerRef: string; status: PaymentStatus }>
  capture(ctx: StoreContext, providerRef: string): Promise<{ status: 'captured' }>
  refund(ctx: StoreContext, providerRef: string, amountPaise: number): Promise<{ status: 'refunded' }>
}

/** Test double. `capture` mode succeeds immediately; `fail` mode throws on createPayment. */
export class FakePaymentProvider implements PaymentProvider {
  readonly id = 'fake'
  readonly calls: string[] = []
  private counter = 0

  constructor(private readonly opts: { mode: 'capture' | 'fail' } = { mode: 'capture' }) {}

  async createPayment(_ctx: StoreContext, input: { orderId: string; amountPaise: number }) {
    this.calls.push(`createPayment:${input.orderId}:${input.amountPaise}`)
    if (this.opts.mode === 'fail') throw new Error('fake gateway declined')
    this.counter += 1
    return { providerRef: `fake_${this.counter}`, status: 'captured' as const }
  }

  async capture(_ctx: StoreContext, providerRef: string) {
    this.calls.push(`capture:${providerRef}`)
    return { status: 'captured' as const }
  }

  async refund(_ctx: StoreContext, providerRef: string, amountPaise: number) {
    this.calls.push(`refund:${providerRef}:${amountPaise}`)
    return { status: 'refunded' as const }
  }
}
```

`packages/core/src/providers/fulfilment.ts`:
```ts
import type { StoreContext } from '../context'

export type Address = {
  name: string
  line1: string
  line2?: string
  city: string
  state: string
  pincode: string
  phone: string
}

export interface FulfilmentProvider {
  readonly id: string
  isServiceable(ctx: StoreContext, pincode: string): Promise<{ serviceable: boolean; etaDays?: number }>
  createShipment(ctx: StoreContext, input: { orderId: string; address: Address }): Promise<{ awb: string }>
}
```

`packages/core/src/providers/notification.ts`:
```ts
import type { StoreContext } from '../context'

export type NotificationChannel = 'email' | 'whatsapp' | 'sms'

export interface NotificationProvider {
  readonly id: string
  readonly channel: NotificationChannel
  send(
    ctx: StoreContext,
    message: { to: string; template: string; data: Record<string, unknown> },
  ): Promise<{ messageId: string }>
}
```

- [ ] **Step 3: Failing workflow runner test**

`packages/core/src/workflow/run.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { runWorkflow, type WorkflowStep } from './run'

type S = { log: string[]; value: number }

function step(name: string, opts: { fail?: boolean; compensate?: boolean } = {}): WorkflowStep<S> {
  return {
    name,
    async run(s) {
      s.log.push(`run:${name}`)
      if (opts.fail) throw new Error(`${name} failed`)
      return { value: s.value + 1 }
    },
    ...(opts.compensate
      ? {
          async compensate(s: S) {
            s.log.push(`undo:${name}`)
          },
        }
      : {}),
  }
}

describe('runWorkflow', () => {
  it('runs steps in order and merges state', async () => {
    const s = await runWorkflow<S>({ log: [], value: 0 }, [step('a'), step('b'), step('c')])
    expect(s.value).toBe(3)
    expect(s.log).toEqual(['run:a', 'run:b', 'run:c'])
  })

  it('on failure compensates completed steps in reverse and rethrows the original error', async () => {
    const s: S = { log: [], value: 0 }
    await expect(
      runWorkflow(s, [
        step('a', { compensate: true }),
        step('b', { compensate: true }),
        step('c', { fail: true, compensate: true }),
        step('d', { compensate: true }),
      ]),
    ).rejects.toThrow('c failed')
    expect(s.log).toEqual(['run:a', 'run:b', 'run:c', 'undo:b', 'undo:a'])
  })

  it('a failing compensation is logged and does not stop the others', async () => {
    const errors: string[] = []
    const s: S = { log: [], value: 0 }
    const broken: WorkflowStep<S> = {
      name: 'b',
      async run() {
        return {}
      },
      async compensate() {
        throw new Error('undo b broke')
      },
    }
    await expect(
      runWorkflow(s, [step('a', { compensate: true }), broken, step('c', { fail: true })], {
        error: (msg) => errors.push(msg),
      }),
    ).rejects.toThrow('c failed')
    expect(s.log).toEqual(['run:a', 'run:c', 'undo:a'])
    expect(errors).toEqual(['compensation failed: b'])
  })
})
```

- [ ] **Step 4: Run, expect failure**

Run: `cd "E:/Dev/my e-commerce" && bun install && cd packages/core && bunx vitest run src/workflow`
Expected: FAIL, cannot find module './run'.

- [ ] **Step 5: Implement runner**

`packages/core/src/workflow/run.ts`:
```ts
export interface WorkflowStep<S> {
  name: string
  run(state: S): Promise<Partial<S>>
  compensate?(state: S): Promise<void>
}

export type WorkflowLog = { error(message: string, err: unknown): void }

const defaultLog: WorkflowLog = {
  error: (message, err) => console.error(message, err),
}

/**
 * Run steps in order, merging each result into `state`. If step N throws,
 * compensations for steps N-1..0 run in reverse; each compensation error is
 * logged and swallowed; the original error is rethrown.
 */
export async function runWorkflow<S>(
  state: S,
  steps: WorkflowStep<S>[],
  log: WorkflowLog = defaultLog,
): Promise<S> {
  const completed: WorkflowStep<S>[] = []
  for (const step of steps) {
    try {
      const patch = await step.run(state)
      Object.assign(state as object, patch)
      completed.push(step)
    } catch (err) {
      for (const done of completed.reverse()) {
        if (!done.compensate) continue
        try {
          await done.compensate(state)
        } catch (compErr) {
          log.error(`compensation failed: ${done.name}`, compErr)
        }
      }
      throw err
    }
  }
  return state
}
```

`packages/core/src/index.ts`:
```ts
export * from './errors'
export type { StoreContext } from './context'
export * from './providers/payment'
export * from './providers/fulfilment'
export * from './providers/notification'
export * from './workflow/run'
```

- [ ] **Step 6: Run, expect pass**

Run: `cd "E:/Dev/my e-commerce/packages/core" && bunx vitest run src/workflow && bunx tsc --noEmit`
Expected: 3 passed, tsc silent.

- [ ] **Step 7: Commit**

```bash
git add packages/core bun.lock && git commit -m "feat(core): errors, store context, provider interfaces, workflow runner"
```

---

### Task 6: Place-order workflow

**Files:**
- Create: `packages/core/src/order/place-order.ts`, `packages/core/src/order/place-order.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `withStore`, table objects from `@commerce/db`; `runWorkflow`, errors, `PaymentProvider` from Task 5.
- Produces: `placeOrder(ctx: StoreContext, input: { cartId: string; paymentProvider: PaymentProvider }): Promise<{ orderId: string; orderNumber: number; paymentStatus: PaymentStatus }>`. Must be called inside `withStore`; the caller owns the transaction.

- [ ] **Step 1: Failing tests**

`packages/core/src/order/place-order.test.ts`:
```ts
import {
  cart,
  cartLine,
  createDb,
  inventoryLevel,
  order,
  orderLine,
  payment,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { CartNotOpen, OutOfStock, PaymentFailed } from '../errors'
import { FakePaymentProvider } from '../providers/payment'
import { placeOrder } from './place-order'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

type Seed = { storeId: string; cartId: string; variantId: string }

async function seed(opts: { onHand: number; quantity: number }): Promise<Seed> {
  const [s] = await owner.insert(store).values({ slug: 'waimers', name: 'Waimers' }).returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'mouse', title: 'Mouse', status: 'active' })
    .returning()
  if (!p) throw new Error('seed')
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p.id, title: 'Black', pricePaise: 499900 })
    .returning()
  if (!v) throw new Error('seed')
  await owner.insert(inventoryLevel).values({ storeId: s.id, variantId: v.id, onHand: opts.onHand })
  const [c] = await owner.insert(cart).values({ storeId: s.id }).returning()
  if (!c) throw new Error('seed')
  await owner.insert(cartLine).values({
    storeId: s.id,
    cartId: c.id,
    variantId: v.id,
    quantity: opts.quantity,
    unitPricePaise: v.pricePaise,
  })
  return { storeId: s.id, cartId: c.id, variantId: v.id }
}

beforeEach(async () => {
  await resetDb(owner)
})

describe('placeOrder', () => {
  it('reserves stock, creates the order and payment, converts the cart', async () => {
    const { storeId, cartId, variantId } = await seed({ onHand: 5, quantity: 2 })
    const provider = new FakePaymentProvider({ mode: 'capture' })

    const result = await withStore(app, storeId, (tx) =>
      placeOrder({ storeId, tx }, { cartId, paymentProvider: provider }),
    )

    expect(result.orderNumber).toBe(1)
    expect(result.paymentStatus).toBe('captured')

    const [o] = await owner.select().from(order).where(eq(order.id, result.orderId))
    expect(o?.totalPaise).toBe(999800)
    expect(o?.status).toBe('paid')
    const lines = await owner.select().from(orderLine).where(eq(orderLine.orderId, result.orderId))
    expect(lines).toHaveLength(1)
    const [pay] = await owner.select().from(payment).where(eq(payment.orderId, result.orderId))
    expect(pay?.status).toBe('captured')
    expect(pay?.amountPaise).toBe(999800)
    const [inv] = await owner.select().from(inventoryLevel).where(eq(inventoryLevel.variantId, variantId))
    expect(inv?.reserved).toBe(2)
    const [c] = await owner.select().from(cart).where(eq(cart.id, cartId))
    expect(c?.status).toBe('converted')
    const [s] = await owner.select().from(store).where(eq(store.id, storeId))
    expect(s?.nextOrderNumber).toBe(2)
    expect(provider.calls).toEqual([`createPayment:${result.orderId}:999800`])
  })

  it('throws OutOfStock and leaves nothing behind when stock is short', async () => {
    const { storeId, cartId, variantId } = await seed({ onHand: 1, quantity: 2 })
    const provider = new FakePaymentProvider({ mode: 'capture' })

    await expect(
      withStore(app, storeId, (tx) => placeOrder({ storeId, tx }, { cartId, paymentProvider: provider })),
    ).rejects.toBeInstanceOf(OutOfStock)

    expect(await owner.select().from(order)).toEqual([])
    const [inv] = await owner.select().from(inventoryLevel).where(eq(inventoryLevel.variantId, variantId))
    expect(inv?.reserved).toBe(0)
    expect(provider.calls).toEqual([])
  })

  it('throws PaymentFailed, releases stock and keeps the cart open when the gateway declines', async () => {
    const { storeId, cartId, variantId } = await seed({ onHand: 5, quantity: 2 })
    const provider = new FakePaymentProvider({ mode: 'fail' })

    await expect(
      withStore(app, storeId, (tx) => placeOrder({ storeId, tx }, { cartId, paymentProvider: provider })),
    ).rejects.toBeInstanceOf(PaymentFailed)

    expect(await owner.select().from(order)).toEqual([])
    const [inv] = await owner.select().from(inventoryLevel).where(eq(inventoryLevel.variantId, variantId))
    expect(inv?.reserved).toBe(0)
    const [c] = await owner.select().from(cart).where(eq(cart.id, cartId))
    expect(c?.status).toBe('open')
  })

  it('rejects a cart that is not open', async () => {
    const { storeId, cartId } = await seed({ onHand: 5, quantity: 1 })
    await owner.update(cart).set({ status: 'converted' }).where(eq(cart.id, cartId))
    await expect(
      withStore(app, storeId, (tx) =>
        placeOrder({ storeId, tx }, { cartId, paymentProvider: new FakePaymentProvider() }),
      ),
    ).rejects.toBeInstanceOf(CartNotOpen)
  })

  it('order numbers increase per store', async () => {
    const first = await seed({ onHand: 10, quantity: 1 })
    const [c2] = await owner.insert(cart).values({ storeId: first.storeId }).returning()
    if (!c2) throw new Error('seed')
    await owner.insert(cartLine).values({
      storeId: first.storeId,
      cartId: c2.id,
      variantId: first.variantId,
      quantity: 1,
      unitPricePaise: 499900,
    })
    const provider = new FakePaymentProvider()
    const r1 = await withStore(app, first.storeId, (tx) =>
      placeOrder({ storeId: first.storeId, tx }, { cartId: first.cartId, paymentProvider: provider }),
    )
    const r2 = await withStore(app, first.storeId, (tx) =>
      placeOrder({ storeId: first.storeId, tx }, { cartId: c2.id, paymentProvider: provider }),
    )
    expect([r1.orderNumber, r2.orderNumber]).toEqual([1, 2])
  })
})
```

- [ ] **Step 2: Run, expect failure**

Run: `cd "E:/Dev/my e-commerce/packages/core" && bunx vitest run src/order`
Expected: FAIL, cannot find module './place-order'.

- [ ] **Step 3: Implement**

`packages/core/src/order/place-order.ts`:
```ts
import { cart, cartLine, inventoryLevel, order, orderLine, payment, store } from '@commerce/db'
import { and, eq, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CartEmpty, CartNotOpen, OutOfStock, PaymentFailed } from '../errors'
import type { PaymentProvider, PaymentStatus } from '../providers/payment'
import { runWorkflow, type WorkflowStep } from '../workflow/run'

export type PlaceOrderInput = { cartId: string; paymentProvider: PaymentProvider }
export type PlaceOrderResult = { orderId: string; orderNumber: number; paymentStatus: PaymentStatus }

type Line = { variantId: string; quantity: number; unitPricePaise: number }

type State = {
  ctx: StoreContext
  input: PlaceOrderInput
  lines: Line[]
  reserved: Line[]
  orderId: string | null
  orderNumber: number | null
  providerRef: string | null
  paymentStatus: PaymentStatus | null
}

const loadCart: WorkflowStep<State> = {
  name: 'loadCart',
  async run({ ctx, input }) {
    const [c] = await ctx.tx.select().from(cart).where(eq(cart.id, input.cartId))
    if (!c || c.status !== 'open') throw new CartNotOpen(input.cartId, ctx.storeId)
    const lines = await ctx.tx
      .select({
        variantId: cartLine.variantId,
        quantity: cartLine.quantity,
        unitPricePaise: cartLine.unitPricePaise,
      })
      .from(cartLine)
      .where(eq(cartLine.cartId, input.cartId))
    if (lines.length === 0) throw new CartEmpty(input.cartId, ctx.storeId)
    return { lines }
  },
}

const reserveStock: WorkflowStep<State> = {
  name: 'reserveStock',
  async run({ ctx, lines }) {
    const reserved: Line[] = []
    for (const line of lines) {
      const rows = await ctx.tx
        .update(inventoryLevel)
        .set({ reserved: sql`${inventoryLevel.reserved} + ${line.quantity}` })
        .where(
          and(
            eq(inventoryLevel.variantId, line.variantId),
            sql`${inventoryLevel.onHand} - ${inventoryLevel.reserved} >= ${line.quantity}`,
          ),
        )
        .returning({ id: inventoryLevel.id })
      if (rows.length === 0) throw new OutOfStock(line.variantId, ctx.storeId)
      reserved.push(line)
    }
    return { reserved }
  },
  async compensate({ ctx, reserved }) {
    for (const line of reserved) {
      await ctx.tx
        .update(inventoryLevel)
        .set({ reserved: sql`${inventoryLevel.reserved} - ${line.quantity}` })
        .where(eq(inventoryLevel.variantId, line.variantId))
    }
  },
}

const createOrder: WorkflowStep<State> = {
  name: 'createOrder',
  async run({ ctx, lines }) {
    const [s] = await ctx.tx
      .update(store)
      .set({ nextOrderNumber: sql`${store.nextOrderNumber} + 1` })
      .where(eq(store.id, ctx.storeId))
      .returning({ next: store.nextOrderNumber })
    if (!s) throw new Error(`store ${ctx.storeId} not visible in context`)
    const orderNumber = s.next - 1
    const subtotalPaise = lines.reduce((sum, l) => sum + l.quantity * l.unitPricePaise, 0)
    const [o] = await ctx.tx
      .insert(order)
      .values({
        storeId: ctx.storeId,
        number: orderNumber,
        status: 'placed',
        subtotalPaise,
        totalPaise: subtotalPaise,
      })
      .returning({ id: order.id })
    if (!o) throw new Error('order insert returned nothing')
    await ctx.tx.insert(orderLine).values(
      lines.map((l) => ({
        storeId: ctx.storeId,
        orderId: o.id,
        variantId: l.variantId,
        quantity: l.quantity,
        unitPricePaise: l.unitPricePaise,
      })),
    )
    return { orderId: o.id, orderNumber }
  },
  async compensate({ ctx, orderId }) {
    if (!orderId) return
    await ctx.tx.delete(orderLine).where(eq(orderLine.orderId, orderId))
    await ctx.tx.delete(order).where(eq(order.id, orderId))
  },
}

const createPayment: WorkflowStep<State> = {
  name: 'createPayment',
  async run({ ctx, input, lines, orderId }) {
    if (!orderId) throw new Error('createPayment before createOrder')
    const amountPaise = lines.reduce((sum, l) => sum + l.quantity * l.unitPricePaise, 0)
    let result: { providerRef: string; status: PaymentStatus }
    try {
      result = await input.paymentProvider.createPayment(ctx, { orderId, amountPaise, customer: {} })
    } catch (cause) {
      throw new PaymentFailed(input.paymentProvider.id, cause, ctx.storeId)
    }
    await ctx.tx.insert(payment).values({
      storeId: ctx.storeId,
      orderId,
      provider: input.paymentProvider.id,
      providerRef: result.providerRef,
      status: result.status,
      amountPaise,
    })
    if (result.status === 'captured') {
      await ctx.tx.update(order).set({ status: 'paid' }).where(eq(order.id, orderId))
    }
    return { providerRef: result.providerRef, paymentStatus: result.status }
  },
  async compensate({ ctx, input, lines, providerRef, paymentStatus }) {
    if (providerRef && paymentStatus === 'captured') {
      const amountPaise = lines.reduce((sum, l) => sum + l.quantity * l.unitPricePaise, 0)
      await input.paymentProvider.refund(ctx, providerRef, amountPaise)
    }
  },
}

const markCartConverted: WorkflowStep<State> = {
  name: 'markCartConverted',
  async run({ ctx, input }) {
    await ctx.tx.update(cart).set({ status: 'converted' }).where(eq(cart.id, input.cartId))
    return {}
  },
}

/**
 * Place an order from an open cart. Must run inside `withStore`; the caller's
 * transaction rolls back on throw, and compensations additionally undo the
 * one side effect outside the database (a captured payment).
 */
export async function placeOrder(ctx: StoreContext, input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const state = await runWorkflow<State>(
    {
      ctx,
      input,
      lines: [],
      reserved: [],
      orderId: null,
      orderNumber: null,
      providerRef: null,
      paymentStatus: null,
    },
    [loadCart, reserveStock, createOrder, createPayment, markCartConverted],
  )
  if (!state.orderId || state.orderNumber === null || !state.paymentStatus) {
    throw new Error('placeOrder finished without an order')
  }
  return { orderId: state.orderId, orderNumber: state.orderNumber, paymentStatus: state.paymentStatus }
}
```

Add to `packages/core/src/index.ts`:
```ts
export * from './order/place-order'
```

- [ ] **Step 4: Run, expect pass**

Run: `cd "E:/Dev/my e-commerce/packages/core" && bunx vitest run && bunx tsc --noEmit`
Expected: 8 passed (3 runner + 5 order), tsc silent.

If `resolve '@commerce/db/test'` fails under Vitest: add to `packages/core/vitest.config.ts` inside `defineConfig`: `resolve: { alias: { '@commerce/db/test': new URL('../db/test/reset.ts', import.meta.url).pathname } }`.

- [ ] **Step 5: Commit**

```bash
git add packages/core && git commit -m "feat(core): place-order workflow with stock reservation and compensation"
```

---

### Task 7: Worker app

**Files:**
- Create: `apps/worker/package.json`, `apps/worker/tsconfig.json`, `apps/worker/src/queues.ts`, `apps/worker/src/index.ts`

**Interfaces:**
- Consumes: `loadEnv` from `@commerce/config`, `createDb` from `@commerce/db`.
- Produces: HTTP `GET /health` → `{ ok: boolean, db: boolean, queue: boolean }`; queue `{system}:heartbeat`.

- [ ] **Step 1: Package files**

`apps/worker/package.json`:
```json
{
  "name": "@commerce/worker",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun run --watch --env-file=../../.env src/index.ts",
    "start": "bun run src/index.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@commerce/config": "workspace:*",
    "@commerce/core": "workspace:*",
    "@commerce/db": "workspace:*",
    "bullmq": "^5.81.5",
    "drizzle-orm": "^0.45.2",
    "hono": "^4.13.8",
    "ioredis": "^5.10.1"
  },
  "devDependencies": {
    "@types/bun": "^1.3.11",
    "typescript": "~5.9.3"
  }
}
```

`apps/worker/tsconfig.json`:
```json
{
  "extends": "@commerce/config/tsconfig.base.json",
  "compilerOptions": { "types": ["bun"] },
  "include": ["src"]
}
```

- [ ] **Step 2: Queues**

`apps/worker/src/queues.ts`:
```ts
import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'

export const HEARTBEAT_QUEUE = '{system}:heartbeat'

export function createConnection(redisUrl: string): IORedis {
  return new IORedis(redisUrl, { maxRetriesPerRequest: null })
}

export function createHeartbeat(connection: IORedis) {
  const queue = new Queue(HEARTBEAT_QUEUE, { connection })
  const worker = new Worker(
    HEARTBEAT_QUEUE,
    async (job) => {
      console.log(`[heartbeat] job ${job.id} at ${new Date().toISOString()}`)
    },
    { connection },
  )
  return { queue, worker }
}
```

- [ ] **Step 3: App**

`apps/worker/src/index.ts`:
```ts
import { loadEnv } from '@commerce/config'
import { createDb } from '@commerce/db'
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { createConnection, createHeartbeat } from './queues'

const env = loadEnv(process.env)
const db = createDb(env.DATABASE_URL)
const redis = createConnection(env.REDIS_URL)
const { queue, worker } = createHeartbeat(redis)

await queue.upsertJobScheduler('heartbeat-every-minute', { every: 60_000 }, { name: 'tick' })

const app = new Hono()

app.get('/health', async (c) => {
  const [dbOk, queueOk] = await Promise.all([
    db
      .execute(sql`select 1`)
      .then(() => true)
      .catch(() => false),
    redis
      .ping()
      .then((r) => r === 'PONG')
      .catch(() => false),
  ])
  const ok = dbOk && queueOk
  return c.json({ ok, db: dbOk, queue: queueOk }, ok ? 200 : 503)
})

const shutdown = async () => {
  await worker.close()
  await queue.close()
  redis.disconnect()
  await db.$client.end()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

console.log(`worker listening on :${env.WORKER_PORT}`)

export default { port: env.WORKER_PORT, fetch: app.fetch }
```

- [ ] **Step 4: Run and verify**

Run:
```bash
cd "E:/Dev/my e-commerce" && bun install && cp -n .env.example .env; cd apps/worker && bunx tsc --noEmit && (bun run --env-file=../../.env src/index.ts & for i in 1 2 3 4 5 6 7 8 9 10; do curl -sf localhost:4100/health && break; done; echo; kill %1)
```
Expected: tsc silent; curl prints `{"ok":true,"db":true,"queue":true}`.

If BullMQ logs an error about `CLUSTERDOWN` or hash slots, Dragonfly is not running with the emulated cluster flags: check `docker compose ps` and the command line in `docker-compose.yml`.

- [ ] **Step 5: Commit**

```bash
git add apps/worker bun.lock && git commit -m "feat(worker): hono health endpoint and bullmq heartbeat on dragonfly"
```

---

### Task 8: Full pipeline check and README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Run everything through turbo**

Run: `cd "E:/Dev/my e-commerce" && bun run lint && bun run typecheck && bun run test`
Expected: biome clean, three typechecks pass, test tasks pass for config, db, core (worker has no tests).

Fix any Biome findings with `bun run lint:fix` and re-run.

- [ ] **Step 2: README**

`README.md`:
```markdown
# Commerce platform

Multi-tenant commerce core for Indian D2C stores. Session one: schema with
row-level security, place-order workflow, worker process. Design in
`docs/superpowers/specs/`, wider plan in `E:\Dev\Shopify\docs\`.

## Run

    bun install
    bun run infra:up          # postgres 17 + dragonfly
    cp .env.example .env
    bun run db:migrate        # applies to DATABASE_URL_OWNER in .env
    bun run test
    bun run --cwd apps/worker dev
    curl localhost:4100/health

Tests use `commerce_test`, created by `docker/postgres/init.sql` on first boot.
If the volume predates that file: `docker compose down -v && bun run infra:up`.

## Rules

- Every tenant table has `store_id`, RLS enabled and forced, policy `store_isolation`.
  Any migration that adds a table ends with `select apply_store_rls();`.
  `packages/db/test/rls-coverage.test.ts` fails otherwise.
- The app connects as role `app`. Never as `postgres` outside migrations and tests.
- Query tenant data only inside `withStore`. `withoutStore` is for migrations and
  cross-store jobs on the owner connection, and is named so it stands out.
- `core` and `db` never import from `features` or `apps`.
- Money is integer paise. Ids are UUID v7 from `newId()`.
```

- [ ] **Step 3: Commit**

```bash
git add README.md && git commit -m "docs: readme with run steps and tenancy rules"
```
