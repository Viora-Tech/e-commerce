import { describe, expect, it } from 'vitest'
import {
  appendNode,
  buildTree,
  countDescendants,
  findNode,
  flatten,
  moveNode,
  projectDrop,
  removeChildrenOf,
  removeNode,
  replaceNode,
  subtreeHeight,
  type TreeNode,
} from './tree'

type Node = TreeNode & { title?: string; children?: Node[] | undefined }

//  a
//  ├ a1
//  │ └ a1x
//  └ a2
//  b
//  c
const tree: Node[] = [
  { id: 'a', children: [{ id: 'a1', children: [{ id: 'a1x' }] }, { id: 'a2' }] },
  { id: 'b' },
  { id: 'c' },
]

const ids = (items: readonly Node[]): unknown =>
  items.map((n) => (n.children?.length ? { [n.id]: ids(n.children) } : n.id))

describe('flatten and buildTree', () => {
  it('lists rows depth first with depth, parent and sibling index', () => {
    expect(flatten(tree).map((r) => [r.id, r.parentId, r.depth, r.index])).toEqual([
      ['a', null, 0, 0],
      ['a1', 'a', 1, 0],
      ['a1x', 'a1', 2, 0],
      ['a2', 'a', 1, 1],
      ['b', null, 0, 1],
      ['c', null, 0, 2],
    ])
  })

  it('round-trips without adding empty child lists', () => {
    const rebuilt = buildTree(flatten(tree))
    expect(rebuilt).toEqual(tree)
    expect('children' in (rebuilt[1] as Node)).toBe(false)
  })

  it('keeps a row whose parent is missing at the top level', () => {
    const rows = flatten(tree).filter((r) => r.id !== 'a1')
    expect(ids(buildTree(rows))).toEqual([{ a: ['a2'] }, 'a1x', 'b', 'c'])
  })
})

describe('descendants', () => {
  it('counts every row below an item', () => {
    const flat = flatten(tree)
    expect(countDescendants(flat, 'a')).toBe(3)
    expect(countDescendants(flat, 'a1')).toBe(1)
    expect(countDescendants(flat, 'b')).toBe(0)
    expect(countDescendants(flat, 'missing')).toBe(0)
  })

  it('measures how many levels an item carries', () => {
    const flat = flatten(tree)
    expect(subtreeHeight(flat, 'a')).toBe(2)
    expect(subtreeHeight(flat, 'a1')).toBe(1)
    expect(subtreeHeight(flat, 'c')).toBe(0)
  })

  it('removes the descendants of dragged rows, however deep', () => {
    expect(removeChildrenOf(flatten(tree), ['a']).map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('projectDrop', () => {
  const indentWidth = 32

  it('reorders at the same depth when the pointer does not travel sideways', () => {
    const flat = removeChildrenOf(flatten(tree), ['c'])
    expect(projectDrop({ flat, activeId: 'c', overId: 'b', dragOffsetX: 0, indentWidth })).toEqual({
      depth: 0,
      parentId: null,
    })
  })

  it('nests under the row above when dragged right one indent', () => {
    const flat = flatten(tree)
    expect(projectDrop({ flat, activeId: 'c', overId: 'c', dragOffsetX: 32, indentWidth })).toEqual(
      {
        depth: 1,
        parentId: 'b',
      },
    )
  })

  it('never nests more than one level below the row above', () => {
    const flat = flatten(tree)
    expect(
      projectDrop({ flat, activeId: 'c', overId: 'c', dragOffsetX: 32 * 5, indentWidth }),
    ).toEqual({ depth: 1, parentId: 'b' })
  })

  it('outdents when dragged left, back to its grandparent level', () => {
    const flat = flatten(tree)
    expect(
      projectDrop({ flat, activeId: 'a2', overId: 'a2', dragOffsetX: -32, indentWidth }),
    ).toEqual({ depth: 0, parentId: null })
  })

  it('will not outdent past the row below, which would orphan it', () => {
    const flat = flatten(tree)
    // a2 sits below a1x at depth 1; lifting a1x to the top level would split
    // a2 away from its parent, so the shallowest it can go is a2's depth.
    expect(
      projectDrop({ flat, activeId: 'a1x', overId: 'a1x', dragOffsetX: -64, indentWidth }),
    ).toEqual({ depth: 1, parentId: 'a' })
  })

  it('keeps what a parent carries within three levels', () => {
    // Dragging a (two levels below it) cannot become a child of b: its
    // grandchild would land on a fourth level.
    const flat = removeChildrenOf(flatten(tree), ['a'])
    const projection = projectDrop({
      flat,
      activeId: 'a',
      overId: 'b',
      dragOffsetX: 64,
      indentWidth,
      carriedHeight: subtreeHeight(flatten(tree), 'a'),
    })
    expect(projection).toEqual({ depth: 0, parentId: null })
  })

  it('returns null for an unknown row', () => {
    expect(
      projectDrop({ flat: flatten(tree), activeId: 'x', overId: 'b', dragOffsetX: 0, indentWidth }),
    ).toBeNull()
  })
})

describe('moveNode', () => {
  it('moves a parent with everything below it', () => {
    const moved = moveNode(tree, {
      activeId: 'a',
      overId: 'c',
      projection: { depth: 0, parentId: null },
    })
    expect(ids(moved)).toEqual(['b', 'c', { a: [{ a1: ['a1x'] }, 'a2'] }])
  })

  it('nests an item under another', () => {
    const moved = moveNode(tree, {
      activeId: 'c',
      overId: 'c',
      projection: { depth: 1, parentId: 'b' },
    })
    expect(ids(moved)).toEqual([{ a: [{ a1: ['a1x'] }, 'a2'] }, { b: ['c'] }])
  })

  it('lifts a child out to the top level', () => {
    const moved = moveNode(tree, {
      activeId: 'a2',
      overId: 'a2',
      projection: { depth: 0, parentId: null },
    })
    expect(ids(moved)).toEqual([{ a: [{ a1: ['a1x'] }] }, 'a2', 'b', 'c'])
  })
})

describe('editing', () => {
  it('finds, replaces, appends and removes nodes at any depth', () => {
    expect(findNode(tree, 'a1x')?.id).toBe('a1x')
    const renamed = replaceNode(tree, { id: 'a1', title: 'Renamed' })
    expect(findNode(renamed, 'a1')?.title).toBe('Renamed')
    expect(findNode(renamed, 'a1x')).toBeDefined()

    const appended = appendNode(tree, { id: 'b1' }, 'b')
    expect(ids(appended)).toEqual([{ a: [{ a1: ['a1x'] }, 'a2'] }, { b: ['b1'] }, 'c'])
    expect(ids(appendNode(tree, { id: 'd' }, null))).toEqual([
      { a: [{ a1: ['a1x'] }, 'a2'] },
      'b',
      'c',
      'd',
    ])

    const removed = removeNode(tree, 'a1x')
    expect(ids(removed)).toEqual([{ a: ['a1', 'a2'] }, 'b', 'c'])
    expect('children' in (findNode(removed, 'a1') as Node)).toBe(false)
  })
})
