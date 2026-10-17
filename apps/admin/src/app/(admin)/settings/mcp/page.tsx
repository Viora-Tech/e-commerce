import { loadEnv } from '@commerce/config'
import type { Metadata } from 'next'
import McpPage from '@/components/mcp/mcp-page'
import { mcpContent } from '@/data/mcp'
import { appRouter, call, serverContext } from '@/lib/api'
import { getCopy } from '@/lib/copy-server'
import { mcpServerUrl } from '@/lib/mcp'

export async function generateMetadata(): Promise<Metadata> {
  const copy = await getCopy(mcpContent)
  return { title: copy.title }
}

export default async function Page() {
  const context = await serverContext()
  const [overview, grants] = await Promise.all([
    call(appRouter.apiAccess.overview, undefined, { context }),
    call(appRouter.apiAccess.grants, undefined, { context }),
  ])
  const serverUrl = mcpServerUrl(loadEnv(process.env).ADMIN_URL, overview.store.slug)
  return <McpPage overview={overview} grants={grants} serverUrl={serverUrl} />
}
