import type { McpClientId } from '@commerce/core/api-access'

/** A store's MCP address: `<admin origin>/api/mcp/<slug>`. */
export const mcpServerUrl = (origin: string, slug: string) =>
  `${origin.replace(/\/$/, '')}/api/mcp/${slug}`

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
