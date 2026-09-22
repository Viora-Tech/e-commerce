import { describe, expect, it } from 'vitest'
import { countNodes, type TreeNode, treeLevels } from './tree'

//  a
//  ├ a1
//  │ └ a1x
//  └ a2
//  b
//  c
const tree: TreeNode[] = [
  { id: 'a', children: [{ id: 'a1', children: [{ id: 'a1x' }] }, { id: 'a2' }] },
  { id: 'b' },
  { id: 'c' },
]

describe('tree facts', () => {
  it('counts levels and nodes', () => {
    expect(treeLevels(tree)).toBe(3)
    expect(treeLevels([])).toBe(0)
    expect(countNodes(tree)).toBe(6)
  })
})
