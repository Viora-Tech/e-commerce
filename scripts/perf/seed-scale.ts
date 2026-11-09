/**
 * Scale the dev Waimers store up to a size where slow admin pages show: ~500 products, 2,000
 * customers and 5,000 orders over the last 180 days (about 10% cancelled). Run after
 * `bun run db:seed && bun run db:seed:demo`. Everything it adds is tagged `perf` (orders,
 * customers) or has a `-perfN` handle (products), and `--clean` removes exactly that.
 *
 *   bun run --env-file=.env scripts/perf/seed-scale.ts [--orders 5000] [--customers 2000] [--clean]
 *
 * Bulk SQL (generate_series), not row-by-row inserts: the whole run takes seconds and very
 * little memory. Never point it at a real store's database.
 */
import { createDb } from '@commerce/db'

const argv = process.argv.slice(2)
const num = (flag: string, fallback: number) => {
  const i = argv.indexOf(flag)
  return i >= 0 ? Number(argv[i + 1]) : fallback
}
const ORDERS = num('--orders', 5000)
const CUSTOMERS = num('--customers', 2000)
const PRODUCT_COPIES = num('--product-copies', 6)
const TAG = 'perf'

// biome-ignore lint/suspicious/noUndeclaredEnvVars: a local dev script, not a turbo task
const url = process.env.DATABASE_URL_OWNER
if (!url) throw new Error('DATABASE_URL_OWNER is required')
if (!/localhost|127\.0\.0\.1/.test(url))
  throw new Error('refusing: DATABASE_URL_OWNER is not local')
const db = createDb(url, { max: 2 })
const sql = db.$client

/** Every column of a table except the ones we set ourselves, for INSERT ... SELECT copies. */
async function columns(table: string, except: string[]): Promise<string[]> {
  const rows = await sql<{ column_name: string }[]>`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = ${table} and is_generated = 'NEVER'
    order by ordinal_position`
  return rows.map((r) => r.column_name).filter((c) => !except.includes(c))
}
const list = (cols: string[], prefix = '') => cols.map((c) => `${prefix}"${c}"`).join(', ')

async function clean(storeId: string) {
  await sql.begin(async (tx) => {
    const ids = tx`select id from "order" where store_id = ${storeId} and tags @> array[${TAG}]::text[]`
    await tx`delete from payment where order_id in (${ids})`
    await tx`delete from order_line where order_id in (${ids})`
    await tx`create temp table perf_addr on commit drop as
      select shipping_address_id id from "order" where store_id = ${storeId} and tags @> array[${TAG}]::text[]`
    await tx`delete from "order" where store_id = ${storeId} and tags @> array[${TAG}]::text[]`
    await tx`delete from address where id in (select id from perf_addr)`
    await tx`delete from customer where store_id = ${storeId} and tags @> array[${TAG}]::text[]`
    const pids = tx`select id from product where store_id = ${storeId} and handle ~ '-perf[0-9]+$'`
    await tx`delete from inventory_level where variant_id in (select id from variant where product_id in (${pids}))`
    await tx`delete from variant where product_id in (${pids})`
    await tx`delete from product_media where product_id in (${pids})`
    await tx`delete from product where id in (${pids})`
  })
  console.log('perf: removed scaled data')
}

async function main() {
  const [s] = await sql<{ id: string }[]>`select id from store where slug = 'waimers'`
  if (!s) throw new Error('seed the store first (bun run db:seed)')
  const storeId = s.id
  await clean(storeId)
  if (argv.includes('--clean')) return

  await sql.begin(async (tx) => {
    // --- products: copies of the catalogue with their variants, stock and images ---
    await tx`create temp table pmap on commit drop as
      select p.id old_id, gen_random_uuid() new_id, k
      from product p, generate_series(1, ${PRODUCT_COPIES}::int) k
      where p.store_id = ${storeId}`
    const pc = await columns('product', ['id', 'handle', 'title'])
    await tx.unsafe(`insert into product (id, handle, title, ${list(pc)})
      select m.new_id, p.handle || '-perf' || m.k, p.title || ' (' || m.k || ')', ${list(pc, 'p.')}
      from product p join pmap m on m.old_id = p.id`)
    await tx`create temp table vmap on commit drop as
      select v.id old_id, gen_random_uuid() new_id, m.new_id product_id
      from variant v join pmap m on m.old_id = v.product_id`
    const vc = await columns('variant', ['id', 'product_id', 'sku'])
    await tx.unsafe(`insert into variant (id, product_id, sku, ${list(vc)})
      select m.new_id, m.product_id, case when v.sku is null then null else v.sku || '-' || left(m.new_id::text, 8) end, ${list(vc, 'v.')}
      from variant v join vmap m on m.old_id = v.id`)
    const ic = await columns('inventory_level', ['id', 'variant_id'])
    await tx.unsafe(`insert into inventory_level (id, variant_id, ${list(ic)})
      select gen_random_uuid(), m.new_id, ${list(ic, 'i.')}
      from inventory_level i join vmap m on m.old_id = i.variant_id`)
    const mc = await columns('product_media', ['id', 'product_id'])
    await tx.unsafe(`insert into product_media (id, product_id, ${list(mc)})
      select gen_random_uuid(), m.new_id, ${list(mc, 'pm.')}
      from product_media pm join pmap m on m.old_id = pm.product_id`)

    // --- customers ---
    await tx`insert into customer (id, store_id, email, name, phone, tags, accepts_marketing, created_at, default_address)
      select gen_random_uuid(), ${storeId}, 'perf' || g || '@example.in', 'Perf Customer ' || g,
        '9' || lpad((100000000 + g * 7919 % 899999999)::text, 9, '0'),
        case when g % 5 = 0 then array[${TAG}, 'vip'] when g % 7 = 0 then array[${TAG}, 'wholesale', 'tag' || (g % 40)] else array[${TAG}] end,
        g % 3 = 0, now() - (g % 365) * interval '1 day',
        jsonb_build_object('name', 'Perf Customer ' || g, 'line1', g || ', MG Road', 'city', 'Pune', 'stateCode', 'MH', 'pincode', '411001', 'country', 'IN')
      from generate_series(1, ${CUSTOMERS}::int) g`

    // --- orders over the last 180 days, lines from priced variants, one payment each ---
    const [{ next }] = await tx<
      { next: number }[]
    >`select next_order_number next from store where id = ${storeId}`
    await tx`create temp table vpick on commit drop as
      select row_number() over (order by v.id) rn, v.id, v.title, v.price_paise, p.title product_title
      from variant v join product p on p.id = v.product_id
      where v.store_id = ${storeId} and v.price_paise is not null`
    await tx`create temp table cpick on commit drop as
      select row_number() over (order by id) rn, id, email, name from customer
      where store_id = ${storeId} and tags @> array[${TAG}]::text[]`
    await tx`create temp table onew on commit drop as
      select g, gen_random_uuid() id, gen_random_uuid() addr_id,
        now() - ((g * 37 % 180) * interval '1 day') - ((g * 13 % 720) * interval '1 minute') placed,
        (1 + (g * 7 % (select count(*) from cpick)))::int crn,
        case when g % 10 = 0 then 'cancelled' when g % 4 = 0 then 'placed' when g % 3 = 0 then 'paid' when g % 2 = 0 then 'fulfilled' else 'delivered' end stage,
        (array['razorpay','razorpay','cod','cod','manual'])[1 + g % 5] method,
        1 + (g % 3) lines
      from generate_series(1, ${ORDERS}::int) g`
    await tx`create temp table lnew on commit drop as
      select o.id order_id, o.stage, v.id variant_id, v.title, v.product_title, v.price_paise, 1 + ((o.g + l) % 4 = 0)::int qty
      from onew o, generate_series(1, 3) l,
        lateral (select * from vpick where rn = 1 + ((o.g * 31 + l * 17) % (select count(*) from vpick))) v
      where l <= o.lines`
    await tx`insert into address (id, store_id, name, line1, city, state_code, pincode, phone)
      select o.addr_id, ${storeId}, c.name, o.g || ', Link Road', 'Mumbai', 'MH', '400053', '9876543210'
      from onew o join cpick c on c.rn = o.crn`
    await tx`insert into "order" (id, store_id, number, customer_id, email, shipping_address_id, payment_method,
        status, payment_status, fulfillment_status, checkout_paid_at, delivered_at, subtotal_paise,
        payment_adjustment_paise, total_paise, tags, placed_at, updated_at)
      select o.id, ${storeId}, ${next}::int + o.g - 1, c.id, c.email, o.addr_id, o.method,
        case o.stage when 'cancelled' then 'cancelled' when 'delivered' then 'completed' else 'open' end,
        case when o.stage in ('placed', 'cancelled') then 'unpaid' else 'paid' end,
        case o.stage when 'delivered' then 'delivered' when 'fulfilled' then 'fulfilled' else 'unfulfilled' end,
        case when o.stage in ('placed', 'cancelled') then null else o.placed end,
        case when o.stage = 'delivered' then o.placed + interval '2 days' end,
        s.sub, case when o.method = 'cod' then 4900 else 0 end,
        s.sub + case when o.method = 'cod' then 4900 else 0 end,
        array[${TAG}], o.placed, o.placed
      from onew o join cpick c on c.rn = o.crn
      join (select order_id, sum(price_paise * qty)::int sub from lnew group by order_id) s on s.order_id = o.id`
    await tx`insert into order_line (id, store_id, order_id, variant_id, title, variant_title, quantity, fulfilled_quantity, unit_price_paise)
      select gen_random_uuid(), ${storeId}, l.order_id, l.variant_id, l.product_title, l.title, l.qty,
        case when l.stage in ('fulfilled', 'delivered') then l.qty else 0 end, l.price_paise
      from lnew l`
    await tx`insert into payment (id, store_id, order_id, provider, provider_ref, status, amount_paise)
      select gen_random_uuid(), ${storeId}, o.id, o.method_, 'perf_' || o.id,
        case o.stage when 'cancelled' then 'failed' when 'placed' then 'pending' else 'captured' end, o.total_paise
      from (select o.id, o.total_paise, n.method method_, n.stage from "order" o join onew n on n.id = o.id) o`
    await tx`update store set next_order_number = ${next}::int + ${ORDERS}::int where id = ${storeId}`
  })
  await sql`analyze`
  const [c] =
    await sql`select (select count(*) from product) products, (select count(*) from variant) variants,
    (select count(*) from customer) customers, (select count(*) from "order") orders, (select count(*) from order_line) lines`
  console.log('perf: scaled store', c)
}

try {
  await main()
} finally {
  await sql.end()
}
