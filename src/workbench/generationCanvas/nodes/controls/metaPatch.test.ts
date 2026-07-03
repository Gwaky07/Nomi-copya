import { describe, expect, it } from 'vitest'
import { deepEquals, mergeMetaIfChanged } from './metaPatch'

describe('metaPatch helpers', () => {
  it('treats deeply equal meta patches as no-op', () => {
    const current = {
      modelKey: 'a',
      archetype: { id: 'x', modeId: 'm', variantId: 'v' },
      tags: ['one', 'two'],
    }
    expect(mergeMetaIfChanged(current, {
      modelKey: 'a',
      archetype: { id: 'x', modeId: 'm', variantId: 'v' },
      tags: ['one', 'two'],
    })).toBeNull()
  })

  it('returns merged meta when any nested value changes', () => {
    const current = { modelKey: 'a', tags: ['one'] }
    expect(mergeMetaIfChanged(current, { tags: ['one', 'two'] })).toEqual({ modelKey: 'a', tags: ['one', 'two'] })
  })

  it('compares nested arrays and objects structurally', () => {
    expect(deepEquals({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true)
    expect(deepEquals({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] })).toBe(false)
  })
})
