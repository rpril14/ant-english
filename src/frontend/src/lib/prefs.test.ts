import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getTranslationVisible, setTranslationVisible } from './prefs'

// Mock localStorage via a simple in-memory store
function makeStorage(initial: Record<string, string> = {}) {
  const store = { ...initial }
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { Object.keys(store).forEach(k => delete store[k]) },
  }
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('getTranslationVisible', () => {
  it('returns true when no preference stored (default on)', () => {
    vi.stubGlobal('localStorage', makeStorage())
    expect(getTranslationVisible()).toBe(true)
  })

  it('returns false when preference is "false"', () => {
    vi.stubGlobal('localStorage', makeStorage({ showTranslation: 'false' }))
    expect(getTranslationVisible()).toBe(false)
  })

  it('returns true when preference is "true"', () => {
    vi.stubGlobal('localStorage', makeStorage({ showTranslation: 'true' }))
    expect(getTranslationVisible()).toBe(true)
  })
})

describe('setTranslationVisible', () => {
  it('persists false to localStorage', () => {
    const storage = makeStorage()
    vi.stubGlobal('localStorage', storage)
    setTranslationVisible(false)
    expect(storage.getItem('showTranslation')).toBe('false')
  })

  it('persists true to localStorage', () => {
    const storage = makeStorage()
    vi.stubGlobal('localStorage', storage)
    setTranslationVisible(true)
    expect(storage.getItem('showTranslation')).toBe('true')
  })
})
