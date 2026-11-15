// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { themesContent } from '@/data/themes'
import ThemeVersionHistory from './theme-version-history'

const copy = themesContent.versionHistory

const batches = [
  {
    batchId: 'b-new',
    reason: 'save',
    createdAt: '2026-11-14T10:00:00.000Z',
    createdBy: 'Asha Rao',
    templates: ['index'],
  },
  {
    batchId: 'b-old',
    reason: 'publish',
    createdAt: '2026-11-01T10:00:00.000Z',
    createdBy: 'Ravi Kumar',
    templates: ['index', 'product'],
  },
]

const list = vi.fn(async (_input: unknown) => batches)
const restore = vi.fn(async (_input: unknown) => ({ restored: 1 }))
const success = vi.fn()

vi.mock('@/lib/api-client', () => ({
  api: {
    themes: {
      versions: {
        list: (input: unknown) => list(input),
        restore: (input: unknown) => restore(input),
      },
    },
  },
}))
vi.mock('sonner', () => ({ toast: { success: (m: string) => success(m), error: vi.fn() } }))

const theme = { id: 't1', name: 'Dawn', role: 'main', previewToken: 'tok' }

async function draw(props: Partial<Parameters<typeof ThemeVersionHistory>[0]> = {}) {
  const onOpenChange = vi.fn()
  const onRestored = vi.fn()
  await act(async () => {
    render(
      <ThemeVersionHistory
        open
        theme={theme}
        origin="https://shop.test"
        where="editor"
        me="Kuldeep Singh"
        onOpenChange={onOpenChange}
        onRestored={onRestored}
        {...props}
      />,
    )
  })
  return { onOpenChange, onRestored }
}

describe('ThemeVersionHistory', () => {
  beforeEach(() => {
    list.mockClear()
    restore.mockClear()
    success.mockClear()
  })

  it('shows Now (the member editing) first and tags the newest of a live theme Live', async () => {
    await draw()
    expect(screen.getByText(copy.now)).toBeTruthy()
    expect(screen.getByText('Kuldeep Singh')).toBeTruthy()
    expect(screen.getByText(copy.current)).toBeTruthy()
    expect(screen.getByText(copy.live)).toBeTruthy()
    expect(screen.getByText(copy.published)).toBeTruthy()
    expect(list).toHaveBeenCalledWith({ themeId: 't1' })
  })

  it('in the library, shows Now only when the theme has unsaved drafts', async () => {
    await draw({ where: 'library', me: undefined, hasDraft: false })
    expect(screen.queryByText(copy.now)).toBeNull()
  })

  it('in the library with drafts, shows Now as the unsaved changes', async () => {
    await draw({ where: 'library', me: undefined, hasDraft: true })
    expect(screen.getByText(copy.now)).toBeTruthy()
    expect(screen.getByText(copy.unsavedDrafts)).toBeTruthy()
  })

  it('does not tag Live on a theme that is not live', async () => {
    await draw({ theme: { ...theme, role: 'unpublished' } })
    expect(screen.queryByText(copy.live)).toBeNull()
    expect(screen.getByText(copy.saved)).toBeTruthy()
  })

  it('picking a row offers Preview and Restore, and Restore restores that version', async () => {
    const { onOpenChange, onRestored } = await draw({ where: 'library', me: undefined })
    expect(screen.queryByText(copy.restore)).toBeNull()
    const row = screen.getByText('Ravi Kumar').closest('button') as HTMLButtonElement
    fireEvent.click(row)
    expect(row.getAttribute('aria-expanded')).toBe('true')
    const preview = screen.getByText(copy.preview).closest('a') as HTMLAnchorElement
    expect(preview.getAttribute('href')).toContain('theme-version=b-old')
    await act(async () => {
      fireEvent.click(screen.getByText(copy.restore))
    })
    expect(restore).toHaveBeenCalledWith({ themeId: 't1', batchId: 'b-old' })
    expect(success).toHaveBeenCalledWith(copy.restored.library)
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onRestored).toHaveBeenCalled()
  })
})
