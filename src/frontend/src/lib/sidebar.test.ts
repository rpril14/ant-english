import { describe, it, expect } from 'vitest'
import { deriveSidebar } from './sidebar'

const sentences = [
  { id: 'a', index: 0, text: 'Hello world.' },
  { id: 'b', index: 1, text: 'How are you?' },
  { id: 'c', index: 2, text: 'Fine thanks.' },
]

describe('deriveSidebar', () => {
  it('all unseen when no progress and no current', () => {
    const items = deriveSidebar(sentences, '', {})
    expect(items.map(i => i.state)).toEqual(['unseen', 'unseen', 'unseen'])
  })

  it('current sentence is highlighted', () => {
    const items = deriveSidebar(sentences, 'b', {})
    expect(items[1].state).toBe('current')
    expect(items[0].state).toBe('unseen')
    expect(items[2].state).toBe('unseen')
  })

  it('completed sentences show completed state', () => {
    const progress = { a: { completed_at: '2026-01-01T00:00:00Z' } }
    const items = deriveSidebar(sentences, 'b', progress)
    expect(items[0].state).toBe('completed')
    expect(items[1].state).toBe('current')
    expect(items[2].state).toBe('unseen')
  })

  it('completed takes precedence over current when revisiting', () => {
    // User jumps back to an already-completed sentence
    const progress = { a: { completed_at: '2026-01-01T00:00:00Z' } }
    const items = deriveSidebar(sentences, 'a', progress)
    expect(items[0].state).toBe('completed')
  })

  it('preserves sentence index and text in output', () => {
    const items = deriveSidebar(sentences, '', {})
    expect(items[0].index).toBe(0)
    expect(items[0].text).toBe('Hello world.')
    expect(items[2].index).toBe(2)
  })
})
