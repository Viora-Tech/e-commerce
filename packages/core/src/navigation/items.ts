import type { NavigationItem, NavigationItemType } from '@commerce/db'
import { z } from 'zod'
import { isPolicyType } from '../policies/client'
import { countNodes, MENU_MAX_LEVELS } from './tree'

/** Most items a single menu may hold, counting every level. */
export const MENU_MAX_ITEMS = 100

/** What a menu item can link to, in the order the editor offers them. */
export const NAVIGATION_ITEM_TYPES = [
  'home',
  'collection',
  'collections',
  'product',
  'page',
  'blog',
  'article',
  'policy',
  'search',
  'url',
] as const satisfies readonly NavigationItemType[]

/** Destinations that need no value: the home page, search and the all-collections page. */
export const VALUELESS_ITEM_TYPES: readonly NavigationItemType[] = ['home', 'search', 'collections']

/** `blog-handle/article-handle`: an article's menu value. */
const ARTICLE_VALUE = /^[^/\s]+\/[^/\s]+$/

/** Why an item's value does not fit its type, or null. */
function valueProblem(item: {
  type: NavigationItemType
  value?: string | undefined
}): string | null {
  if (VALUELESS_ITEM_TYPES.includes(item.type)) return null
  if (item.value === undefined || item.value === '') return 'A destination is required'
  if (item.type === 'article' && !ARTICLE_VALUE.test(item.value)) {
    return 'Pick the blog post again'
  }
  if (item.type === 'policy' && !isPolicyType(item.value)) return 'Pick one of your policies'
  return null
}

/** One item and, recursively, its children. 'value' is the handle or the URL. */
export const NavigationItemSchema: z.ZodType<NavigationItem> = z.lazy(() =>
  z
    .object({
      id: z.string().min(1).max(64),
      title: z.string().trim().min(1).max(120),
      type: z.enum(NAVIGATION_ITEM_TYPES),
      value: z.string().trim().max(500).optional(),
      children: z.array(NavigationItemSchema).max(MENU_MAX_ITEMS).optional(),
    })
    .superRefine((i, ctx) => {
      const problem = valueProblem(i)
      if (problem) ctx.addIssue({ code: 'custom', message: problem, path: ['value'] })
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
