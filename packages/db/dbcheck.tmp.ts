import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL_OWNER as string, { max: 1 })
const rows = await sql`select b.handle as blog, a.handle, a.status, a.tags from article a join blog b on b.id = a.blog_id order by b.handle limit 20`
console.log(rows.map((r) => `${r.blog} ${r.handle} ${r.status} ${JSON.stringify(r.tags)}`).join('\n'))
await sql.end()
