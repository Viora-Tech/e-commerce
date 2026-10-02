'use client'

import { useTheme } from 'next-themes'
import { useEffect } from 'react'
import { MoonIcon, SunIcon } from '../../../icons'
import { Button } from '../../shadcn/button'

export default function ModeToggle() {
  // Hooks
  const { theme, setTheme } = useTheme()
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'm' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setTheme])

  // Event handlers
  const handleSwitchTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  return (
    <Button className="relative" onClick={handleSwitchTheme} size="icon-sm" variant="ghost">
      <SunIcon
        className="rotate-0 scale-100 opacity-100 transition-[rotate,scale,opacity] duration-(--duration-popover) ease-out dark:-rotate-90 dark:scale-75 dark:opacity-0"
        size={16}
      />
      <MoonIcon
        className="absolute rotate-90 scale-75 opacity-0 transition-[rotate,scale,opacity] duration-(--duration-popover) ease-out dark:rotate-0 dark:scale-100 dark:opacity-100"
        size={16}
      />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
