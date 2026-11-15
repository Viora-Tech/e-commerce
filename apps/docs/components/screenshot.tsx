import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { ImageSquare } from '@phosphor-icons/react/ssr'
import Image from 'next/image'
import sharp from 'sharp'
import { screenshotCopy } from '../data/guides'

type ScreenshotProps = {
  name: string
  caption?: string
  aspect?: 'wide' | 'square'
}

/** `"Settings → Payments"` → `settings-payments`: the file name under public/screenshots. */
export const screenshotSlug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const publicPath = (file: string): string =>
  join(/* turbopackIgnore: true */ process.cwd(), 'public', 'screenshots', file)

const publicFile = (file: string): boolean => existsSync(publicPath(file))

/** Pixel size of a capture, so the page reserves its space before it loads. */
async function sizeOf(file: string): Promise<{ width: number; height: number }> {
  const { width = 1600, height = 900 } = await sharp(publicPath(file)).metadata()
  return { width, height }
}

/**
 * A UI screenshot. Shows `public/screenshots/<slug>.webp` (slug of `name`, see
 * `screenshotSlug`) when it exists, and `<slug>.dark.webp` instead in dark mode when that
 * exists too; otherwise a framed placeholder. Captures come from
 * `scripts/screenshots/capture.ts` (README "Updating screenshots"). `name` says which
 * screen; `caption` says exactly which state it shows, and doubles as the alt text.
 * Runs at build time (static export), so the file check and size read cost nothing in the
 * browser; `next/image` is unoptimized in this app, so the WebP is served as is.
 */
export default async function Screenshot({ name, caption, aspect = 'wide' }: ScreenshotProps) {
  const slug = screenshotSlug(name)
  const hasLight = publicFile(`${slug}.webp`)
  const hasDark = hasLight && publicFile(`${slug}.dark.webp`)
  const alt = caption ?? name
  const light = hasLight ? await sizeOf(`${slug}.webp`) : null
  const dark = hasDark ? await sizeOf(`${slug}.dark.webp`) : null

  return (
    <span data-pagefind-ignore="all" className="mt-5 flex flex-col gap-2">
      {light ? (
        <span className="overflow-hidden rounded-xl border border-(--docs-border-strong) bg-(--docs-surface)">
          <Image
            src={`/screenshots/${slug}.webp`}
            alt={alt}
            width={light.width}
            height={light.height}
            className={`block h-auto w-full ${dark ? 'in-[.dark]:hidden' : ''}`}
          />
          {dark && (
            <Image
              src={`/screenshots/${slug}.dark.webp`}
              alt={alt}
              width={dark.width}
              height={dark.height}
              className="hidden h-auto w-full in-[.dark]:block"
            />
          )}
        </span>
      ) : (
        <span
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-(--docs-border-strong) bg-(--docs-surface) p-8 text-center text-(--docs-muted) ${
            aspect === 'wide' ? 'aspect-video' : 'aspect-square max-w-xs'
          }`}
        >
          <ImageSquare size={28} weight="light" />
          <span className="text-sm font-medium">
            {screenshotCopy.label}: {name}
          </span>
          <span className="text-xs text-(--docs-subtle)">{screenshotCopy.placeholder}</span>
        </span>
      )}
      {caption && (
        <span className="text-center text-[0.8125rem] leading-relaxed text-(--docs-muted)">
          {caption}
        </span>
      )}
    </span>
  )
}
