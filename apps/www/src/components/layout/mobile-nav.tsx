'use client'

import { MoreHorizontal, XIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@commerce/ui/shadcn/sheet'
import Link from 'next/link'
import { useState } from 'react'
import { siteContent } from '@/data/site'
import BrandMark from '../common/brand-mark'

const ITEM_CLASS = 'block rounded-lg px-3 py-3 text-lg font-medium text-foreground hover:bg-muted'

export default function MobileNav() {
  // Hooks
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="md:hidden" />}
        aria-label={siteContent.openMenu}
      >
        <MoreHorizontal aria-hidden />
      </SheetTrigger>
      <SheetContent side="right" showCloseButton={false} className="w-[85%] p-4">
        <div className="flex items-center justify-between">
          <SheetTitle className="sr-only">{siteContent.brand}</SheetTitle>
          <SheetDescription className="sr-only">{siteContent.tagline}</SheetDescription>
          <BrandMark />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={siteContent.closeMenu}
            onClick={() => setOpen(false)}
          >
            <XIcon aria-hidden />
          </Button>
        </div>
        <ul className="mt-4 flex flex-col gap-1">
          {siteContent.navLinks.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className={ITEM_CLASS} onClick={() => setOpen(false)}>
                {link.label}
              </Link>
            </li>
          ))}
          <li>
            <a href={siteContent.signIn.href} className={ITEM_CLASS}>
              {siteContent.signIn.label}
            </a>
          </li>
        </ul>
      </SheetContent>
    </Sheet>
  )
}
