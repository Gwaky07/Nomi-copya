import { describe, expect, it } from 'vitest'
import { isNodeInteractivePointerDownTarget } from './useNodeDragResize'

function makeTarget(matchingSelectors: string[]): EventTarget {
  return {
    closest(selector: string) {
      return matchingSelectors.some((needle) => selector.includes(needle)) ? {} : null
    },
  } as unknown as EventTarget
}

describe('isNodeInteractivePointerDownTarget', () => {
  it('treats combobox options and listboxes as interactive targets', () => {
    expect(isNodeInteractivePointerDownTarget(makeTarget(['[role="option"]']))).toBe(true)
    expect(isNodeInteractivePointerDownTarget(makeTarget(['[role="listbox"]']))).toBe(true)
  })

  it('ignores plain non-interactive targets', () => {
    expect(isNodeInteractivePointerDownTarget({} as EventTarget)).toBe(false)
    expect(isNodeInteractivePointerDownTarget(makeTarget([]))).toBe(false)
  })
})
