import { describe, it, expect } from 'vitest'
import { match, applyScoreCap, isComplete } from './matching'

// ── applyScoreCap ─────────────────────────────────────────────────────────────

describe('applyScoreCap', () => {
  it('hintLevel 0 — no cap', () => {
    expect(applyScoreCap(100, 0)).toBe(100)
  })

  it('hintLevel 1 (first letter) — no cap', () => {
    expect(applyScoreCap(100, 1)).toBe(100)
  })

  it('hintLevel 2 (reveal word) — no cap', () => {
    expect(applyScoreCap(100, 2)).toBe(100)
  })

  it('hintLevel 3 (show all) — caps at 60', () => {
    expect(applyScoreCap(100, 3)).toBe(60)
  })

  it('hintLevel 3 — does not raise a score already below 60', () => {
    expect(applyScoreCap(40, 3)).toBe(40)
  })
})

// ── match — proper-name exclusion (AC-103-4) ──────────────────────────────────

describe('match — proper names', () => {
  it('proper name typed wrong does not reduce score', () => {
    // "London" is a named entity — only "i live in" is scoreable
    const result = match('i live in paris', 'I live in London.', ['London'])
    expect(result.score).toBe(100)
  })

  it('all proper nouns — score is 100 regardless of input', () => {
    const result = match('', 'London Paris', ['London', 'Paris'])
    expect(result.score).toBe(100)
  })
})

// ── isComplete ────────────────────────────────────────────────────────────────

describe('isComplete', () => {
  it('returns false while words are still pending', () => {
    const result = match('hello', 'hello world', [])
    expect(isComplete(result)).toBe(false)
  })

  it('returns false when score < 95 and all resolved', () => {
    // "hello" correct, "xyz" wrong — 50%, all resolved
    const result = match('hello xyz ', 'hello world', [])
    expect(isComplete(result)).toBe(false)
  })

  it('returns true when all words correct and score >= 95', () => {
    const result = match('hello world ', 'hello world', [])
    expect(isComplete(result)).toBe(true)
  })

  it('respects custom threshold', () => {
    // 50% score, threshold=50 → complete
    const result = match('hello xyz ', 'hello world', [])
    expect(isComplete(result, 50)).toBe(true)
  })
})
