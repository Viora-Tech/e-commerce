// @vitest-environment jsdom
import { DEFAULT_INBOX_SETTINGS } from '@commerce/core/inbox'
import { defaultTheme } from '@commerce/core/theme'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { customizeInboxEmbedContent as copy } from '@/data/customize-inbox-embed'
import AppsPanel from './apps-panel'

const inbox = vi.hoisted(() => ({ settings: { get: vi.fn(), save: vi.fn() } }))
vi.mock('@/lib/api-client', () => ({ api: { inbox } }))
vi.mock('@/components/pickers/resource-pick-dialog', () => ({ default: () => null }))

beforeEach(() => {
  inbox.settings.get.mockReset().mockResolvedValue({
    settings: DEFAULT_INBOX_SETTINGS,
    timeZone: 'Asia/Kolkata',
  })
  inbox.settings.save.mockReset().mockImplementation(async (patch: unknown) => patch)
})
afterEach(() => {
  vi.useRealTimers()
})

const panel = (installed: string[]) =>
  render(<AppsPanel installed={installed} theme={defaultTheme} onChange={vi.fn()} />)

describe('App embeds: Inbox chat', () => {
  it('is listed only when the Inbox app is installed', async () => {
    const { unmount } = panel([])
    expect(screen.queryByText(copy.label)).toBeNull()
    unmount()
    panel(['inbox'])
    expect(await screen.findByText(copy.label)).toBeTruthy()
    expect(screen.getByRole('link', { name: copy.manage }).getAttribute('href')).toBe(
      '/sales-channels/inbox/settings',
    )
  })

  it("turning it off saves the Inbox app's widget setting", async () => {
    panel(['inbox'])
    const toggle = await screen.findByRole('switch', { name: copy.label })
    await vi.waitFor(() => expect(toggle.hasAttribute('data-disabled')).toBe(false))
    vi.useFakeTimers()
    fireEvent.click(toggle)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700)
    })
    expect(inbox.settings.save).toHaveBeenCalledWith({
      widget: { ...DEFAULT_INBOX_SETTINGS.widget, enabled: false },
    })
  })
})
