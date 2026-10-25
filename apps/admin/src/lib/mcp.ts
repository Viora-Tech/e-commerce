import { siteConfig } from '@commerce/config/site'
import type { McpClientId } from '@commerce/core/api-access'

/** A store's MCP address: `<admin origin>/api/mcp/<slug>`. */
export const mcpServerUrl = (origin: string, slug: string) =>
  `${origin.replace(/\/$/, '')}/api/mcp/${slug}`

/** The name a client lists the server under: the one `initialize` reports (`koomerce`). */
export const mcpServerName = siteConfig.brand.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-')

/**
 * True when the address only answers on this machine or network (a dev server): web apps
 * such as claude.ai and ChatGPT call it from their own servers, so they cannot reach it.
 */
export function isPrivateMcpUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url)
    return (
      protocol !== 'https:' ||
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname) ||
      hostname === '[::1]'
    )
  } catch {
    return true
  }
}

/** `claude mcp add` for Claude Code; with a token it sends it as a header instead of signing in. */
export function claudeCodeCommand(url: string, token?: string): string {
  const base = `claude mcp add --transport http ${mcpServerName} ${url}`
  return token ? `${base} --header "Authorization: Bearer ${token}"` : base
}

/** The JSON a client's MCP config file takes, in the shape each one expects. */
export function mcpJsonConfig(
  shape: 'cursor' | 'vscode' | 'generic' | 'stdio',
  url: string,
  token?: string,
): string {
  const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {}
  const server =
    shape === 'cursor'
      ? { url, ...headers }
      : shape === 'stdio'
        ? {
            command: 'npx',
            args: [
              '-y',
              'mcp-remote',
              url,
              ...(token ? ['--header', `Authorization: Bearer ${token}`] : []),
            ],
          }
        : { type: 'http', url, ...headers }
  const root = shape === 'vscode' ? 'servers' : 'mcpServers'
  return JSON.stringify({ [root]: { [mcpServerName]: server } }, null, 2)
}

/**
 * Where each tool's "Open" button goes: Claude and ChatGPT's connector settings, and Cursor's
 * and VS Code's one-click install links (they add the server, then open our sign-in page).
 */
export function clientInstallUrl(client: McpClientId, url: string, name: string): string {
  switch (client) {
    case 'claude':
      return 'https://claude.ai/settings/connectors'
    case 'chatgpt':
      return 'https://chatgpt.com/#settings/Connectors'
    case 'cursor':
      return `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(name)}&config=${btoa(JSON.stringify({ url }))}`
    case 'vscode':
      return `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name, type: 'http', url }))}`
  }
}
