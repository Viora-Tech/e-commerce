import { Archivo, Figtree } from 'next/font/google'

export const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-archivo',
  display: 'swap',
})

export const figtree = Figtree({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-figtree',
  display: 'swap',
})

export const fontVar: Record<'archivo' | 'figtree', string> = {
  archivo: 'var(--font-archivo)',
  figtree: 'var(--font-figtree)',
}
