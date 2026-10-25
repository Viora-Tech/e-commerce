import { definitionIssues, emptyDefinition, walkNodes } from '@commerce/core/automations'
import { describe, expect, it } from 'vitest'
import {
  edgeTo,
  insertStep,
  loopSourceFor,
  removalCount,
  removeStep,
  subjectAt,
} from './automation-tree'

const base = () => emptyDefinition('order.paid')

describe('insertStep', () => {
  it('adds the first step after the trigger', () => {
    const { def, id } = insertStep(base(), { parent: null }, { kind: 'wait' })
    expect(def.start).toBe(id)
    expect(definitionIssues(def)).toEqual([])
  })

  it('inserts between two steps and keeps the tree whole', () => {
    const a = insertStep(base(), { parent: null }, { kind: 'action', action: 'order.add_tags' })
    const b = insertStep(a.def, { parent: a.id, branch: 'next' }, { kind: 'wait' })
    const c = insertStep(b.def, { parent: a.id, branch: 'next' }, { kind: 'condition' })
    expect(walkNodes(c.def).map((n) => n.id)).toEqual([a.id, c.id, b.id])
    // A new condition keeps what followed on its Then branch.
    expect(c.def.nodes[c.id]).toMatchObject({ next: b.id, otherwise: null })
    expect(edgeTo(c.def, b.id)).toEqual({ parent: c.id, branch: 'next' })
  })

  it('fills the Otherwise branch of a condition', () => {
    const cond = insertStep(base(), { parent: null }, { kind: 'condition' })
    const other = insertStep(cond.def, { parent: cond.id, branch: 'otherwise' }, { kind: 'wait' })
    expect(other.def.nodes[cond.id]).toMatchObject({ next: null, otherwise: other.id })
  })
})

describe('removeStep', () => {
  it('splices out an action and reconnects what followed', () => {
    const a = insertStep(base(), { parent: null }, { kind: 'wait' })
    const b = insertStep(a.def, { parent: a.id, branch: 'next' }, { kind: 'wait' })
    const def = removeStep(b.def, a.id)
    expect(def.start).toBe(b.id)
    expect(Object.keys(def.nodes)).toEqual([b.id])
  })

  it('drops a condition with both branches', () => {
    const cond = insertStep(base(), { parent: null }, { kind: 'condition' })
    const yes = insertStep(cond.def, { parent: cond.id, branch: 'next' }, { kind: 'wait' })
    const no = insertStep(yes.def, { parent: cond.id, branch: 'otherwise' }, { kind: 'wait' })
    expect(removalCount(no.def, cond.id)).toBe(3)
    const def = removeStep(no.def, cond.id)
    expect(def.start).toBeNull()
    expect(def.nodes).toEqual({})
  })
})

describe('Find records and For each', () => {
  it('builds a loop under a Find, offers it only below one, and removes its body with it', () => {
    const find = insertStep(base(), { parent: null }, { kind: 'find' })
    expect(loopSourceFor(base(), { parent: null })).toBeNull()
    const after = { parent: find.id, branch: 'next' } as const
    expect(loopSourceFor(find.def, after)).toBe(find.id)
    const loop = insertStep(find.def, after, { kind: 'forEach', source: find.id })
    const body = { parent: loop.id, branch: 'body' } as const
    // No second loop inside a body; its steps are about the found records.
    expect(loopSourceFor(loop.def, body)).toBeNull()
    expect(subjectAt(loop.def, body, 'order')).toBe('order')
    const tag = insertStep(loop.def, body, { kind: 'action', action: 'order.add_tags' })
    expect(tag.def.nodes[loop.id]).toMatchObject({ body: tag.id, next: null })
    expect(edgeTo(tag.def, tag.id)).toEqual(body)
    expect(definitionIssues(tag.def)).toEqual([])
    expect(removalCount(tag.def, loop.id)).toBe(2)
    const gone = removeStep(tag.def, loop.id)
    expect(Object.keys(gone.nodes)).toEqual([find.id])
  })
})
