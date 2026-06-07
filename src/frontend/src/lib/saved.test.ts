import { describe, it, expect } from 'vitest'
import { toggleSavedId } from './saved'

describe('toggleSavedId', () => {
  it('adds an id that is not in the set', () => {
    const result = toggleSavedId(new Set(['a']), 'b')
    expect(result.has('b')).toBe(true)
    expect(result.has('a')).toBe(true)
  })

  it('removes an id that is already in the set', () => {
    const result = toggleSavedId(new Set(['a', 'b']), 'a')
    expect(result.has('a')).toBe(false)
    expect(result.has('b')).toBe(true)
  })

  it('does not mutate the original set', () => {
    const original = new Set(['a'])
    toggleSavedId(original, 'a')
    expect(original.has('a')).toBe(true)
  })

  it('adding to empty set', () => {
    const result = toggleSavedId(new Set(), 'x')
    expect(result.size).toBe(1)
    expect(result.has('x')).toBe(true)
  })

  it('removing last id yields empty set', () => {
    const result = toggleSavedId(new Set(['x']), 'x')
    expect(result.size).toBe(0)
  })
})
