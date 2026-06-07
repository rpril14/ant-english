import { describe, it, expect } from 'vitest'
import {
  deriveCardState,
  applyFilter,
  applySort,
  formatDuration,
  type LibraryVideo,
} from './library'

// ── helpers ───────────────────────────────────────────────────────────────────

function makeVideo(overrides: Partial<LibraryVideo> = {}): LibraryVideo {
  return {
    videoId: 'v1',
    title: 'Test',
    thumbnailUrl: null,
    durationSeconds: 120,
    transcriptStatus: 'ready',
    sentenceCount: 10,
    practicedCount: 0,
    isFavorited: false,
    customTags: [],
    addedAt: '2024-01-01T00:00:00Z',
    lastStudiedAt: null,
    ...overrides,
  }
}

// ── deriveCardState ───────────────────────────────────────────────────────────

describe('deriveCardState', () => {
  it('queued → processing', () => {
    expect(deriveCardState(makeVideo({ transcriptStatus: 'queued' }))).toBe('processing')
  })

  it('processing → processing', () => {
    expect(deriveCardState(makeVideo({ transcriptStatus: 'processing' }))).toBe('processing')
  })

  it('failed → failed', () => {
    expect(deriveCardState(makeVideo({ transcriptStatus: 'failed' }))).toBe('failed')
  })

  it('ready, 0 practiced → ready', () => {
    expect(deriveCardState(makeVideo({ practicedCount: 0 }))).toBe('ready')
  })

  it('ready, partially practiced → learning', () => {
    expect(deriveCardState(makeVideo({ practicedCount: 5, sentenceCount: 10 }))).toBe('learning')
  })

  it('ready, all practiced → done', () => {
    expect(deriveCardState(makeVideo({ practicedCount: 10, sentenceCount: 10 }))).toBe('done')
  })

  it('ready, sentenceCount 0 → ready (no division by zero)', () => {
    expect(deriveCardState(makeVideo({ practicedCount: 0, sentenceCount: 0 }))).toBe('ready')
  })
})

// ── applyFilter ───────────────────────────────────────────────────────────────

describe('applyFilter', () => {
  const videos = [
    makeVideo({ videoId: 'v1', practicedCount: 5, sentenceCount: 10 }),         // learning
    makeVideo({ videoId: 'v2', practicedCount: 10, sentenceCount: 10 }),        // done
    makeVideo({ videoId: 'v3', practicedCount: 0, isFavorited: true }),         // ready + fav
    makeVideo({ videoId: 'v4', transcriptStatus: 'processing' }),               // processing
  ]

  it('all → returns all', () => {
    expect(applyFilter(videos, 'all')).toHaveLength(4)
  })

  it('learning → only in-progress', () => {
    const result = applyFilter(videos, 'learning')
    expect(result.map(v => v.videoId)).toEqual(['v1'])
  })

  it('done → only completed', () => {
    const result = applyFilter(videos, 'done')
    expect(result.map(v => v.videoId)).toEqual(['v2'])
  })

  it('fav → only favorited', () => {
    const result = applyFilter(videos, 'fav')
    expect(result.map(v => v.videoId)).toEqual(['v3'])
  })
})

// ── applySort ─────────────────────────────────────────────────────────────────

describe('applySort', () => {
  const videos = [
    makeVideo({ videoId: 'v1', practicedCount: 2, sentenceCount: 10, addedAt: '2024-01-01T00:00:00Z' }),
    makeVideo({ videoId: 'v2', practicedCount: 8, sentenceCount: 10, addedAt: '2024-01-03T00:00:00Z' }),
    makeVideo({ videoId: 'v3', practicedCount: 5, sentenceCount: 10, addedAt: '2024-01-02T00:00:00Z', lastStudiedAt: '2024-01-04T00:00:00Z' }),
  ]

  it('recent — by lastStudiedAt then addedAt descending', () => {
    const result = applySort(videos, 'recent')
    // v3 has lastStudiedAt 2024-01-04 (most recent), then v2 addedAt 2024-01-03, then v1 addedAt 2024-01-01
    expect(result.map(v => v.videoId)).toEqual(['v3', 'v2', 'v1'])
  })

  it('progress — by practiced/total descending', () => {
    const result = applySort(videos, 'progress')
    // v2: 80%, v3: 50%, v1: 20%
    expect(result.map(v => v.videoId)).toEqual(['v2', 'v3', 'v1'])
  })

  it('does not mutate the original array', () => {
    const original = [...videos]
    applySort(videos, 'progress')
    expect(videos).toEqual(original)
  })
})

// ── formatDuration ────────────────────────────────────────────────────────────

describe('formatDuration', () => {
  it('null → null', () => expect(formatDuration(null)).toBeNull())
  it('0 → null', () => expect(formatDuration(0)).toBeNull())
  it('90s → 1:30', () => expect(formatDuration(90)).toBe('1:30'))
  it('61s → 1:01 (zero-padded seconds)', () => expect(formatDuration(61)).toBe('1:01'))
  it('3600s → 60:00', () => expect(formatDuration(3600)).toBe('60:00'))
})
