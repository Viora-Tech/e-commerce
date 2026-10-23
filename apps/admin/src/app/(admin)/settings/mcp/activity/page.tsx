import type { Metadata } from 'next'
import McpActivityPage from '@/components/mcp/mcp-activity-page'
import { mcpContent } from '@/data/mcp'
import { appRouter, call, serverContext } from '@/lib/api'
import { getCopy } from '@/lib/copy-server'

export async function generateMetadata(): Promise<Metadata> {
  const copy = await getCopy(mcpContent)
  return { title: copy.activity.title }
}

export default async function Page() {
  const context = await serverContext()
  const overview = await call(appRouter.apiAccess.overview, undefined, { context })
  return <McpActivityPage store={overview.store} />
}
