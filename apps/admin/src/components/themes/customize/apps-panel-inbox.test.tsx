// @vitest-environment jsdom
import { DEFAULT_INBOX_SETTINGS } from '@commerce/core/inbox'
import { defaultTheme } from '@commerce/core/theme'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { customizeInboxEmbedContent as copy } from '@/data/customize-inbox-embed'
import { resetInboxEmbed } from '@/lib/inbox-embed-store'
import AppsPanel from './apps-panel'
import CanvasInboxLauncher from './canvas-inbox-launcher'

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
  resetInboxEmbed()
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

  it('the canvas draws the chat button and moves it with the Position setting', async () => {
    const { container } = render(
      <>
        <AppsPanel installed={['inbox']} theme={defaultTheme} onChange={vi.fn()} />
        <CanvasInboxLauncher />
      </>,
    )
    const button = await vi.waitFor(() => {
      const el = container.querySelector<HTMLElement>(`[title="${copy.label}"]`)
      if (!el) throw new Error('no chat button on the canvas yet')
      return el
    })
    expect(button.className).toContain(
      DEFAULT_INBOX_SETTINGS.widget.horizontal === 'left' ? 'left-4' : 'right-4',
    )
    const toggle = screen.getByRole('switch', { name: copy.label })
    fireEvent.click(toggle)
    expect(container.querySelector(`[title="${copy.label}"]`)).toBeNull()
  })
})
