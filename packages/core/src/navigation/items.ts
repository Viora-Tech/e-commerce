import type { NavigationItem } from '@commerce/db'
import { z } from 'zod'
import { countNodes, MENU_MAX_LEVELS } from './tree'

/** Most items a single menu may hold, counting every level. */
export const MENU_MAX_ITEMS = 100

const itemTypes = ['home', 'product', 'collection', 'page', 'url'] as const

/** One item and, recursively, its children. 'value' is the handle or the URL. */
export const NavigationItemSchema: z.ZodType<NavigationItem> = z.lazy(() =>
  z
    .object({
      id: z.string().min(1).max(64),
      title: z.string().trim().min(1).max(120),
      type: z.enum(itemTypes),
      value: z.string().trim().max(500).optional(),
      children: z.array(NavigationItemSchema).max(MENU_MAX_ITEMS).optional(),
    })
    .refine((i) => i.type === 'home' || (i.value !== undefined && i.value !== ''), {
      message: 'A destination is required',
      path: ['value'],
    }),
)

function checkTree(
  items: readonly NavigationItem[],
  level: number,
  path: (string | number)[],
  seen: Set<string>,
  ctx: z.RefinementCtx,
): void {
  items.forEach((item, index) => {
    const here = [...path, index]
    if (seen.has(item.id)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Menu item ids must be unique',
        path: [...here, 'id'],
      })
    }
    seen.add(item.id)
    const children = item.children ?? []
    if (children.length > 0 && level >= MENU_MAX_LEVELS) {
      ctx.addIssue({
        code: 'custom',
        message: `Menus nest at most ${MENU_MAX_LEVELS} levels deep`,
        path: [...here, 'children'],
      })
      return
    }
    checkTree(children, level + 1, [...here, 'children'], seen, ctx)
  })
}

/** A whole menu's items: nesting at most three levels, unique ids, bounded size. */
export const MenuItemsSchema = z.array(NavigationItemSchema).superRefine((items, ctx) => {
  if (countNodes(items) > MENU_MAX_ITEMS) {
    ctx.addIssue({ code: 'custom', message: `A menu holds at most ${MENU_MAX_ITEMS} items` })
  }
  checkTree(items, 1, [], new Set(), ctx)
})
