/** Card display state derived from transcript_status + practice progress. */
export type CardState = 'processing' | 'failed' | 'ready' | 'learning' | 'done'

export interface LibraryVideo {
  videoId: string
  title: string
  thumbnailUrl: string | null
  durationSeconds: number | null
  transcriptStatus: string
  sentenceCount: number
  practicedCount: number
  isFavorited: boolean
  customTags: string[]
  addedAt: string
  lastStudiedAt: string | null
}

export type FilterId = 'all' | 'learning' | 'done' | 'fav'
export type SortId = 'recent' | 'progress' | 'duration' | 'az'

export function deriveCardState(v: LibraryVideo): CardState {
  if (v.transcriptStatus === 'processing' || v.transcriptStatus === 'queued') return 'processing'
  if (v.transcriptStatus === 'failed') return 'failed'
  if (v.practicedCount >= v.sentenceCount && v.sentenceCount > 0) return 'done'
  if (v.practicedCount > 0) return 'learning'
  return 'ready'
}

export function applyFilter(videos: LibraryVideo[], filter: FilterId): LibraryVideo[] {
  if (filter === 'learning') return videos.filter(v => deriveCardState(v) === 'learning')
  if (filter === 'done') return videos.filter(v => deriveCardState(v) === 'done')
  if (filter === 'fav') return videos.filter(v => v.isFavorited)
  return videos
}

export function applySort(videos: LibraryVideo[], sort: SortId): LibraryVideo[] {
  return [...videos].sort((a, b) => {
    if (sort === 'progress') {
      const pA = a.sentenceCount ? a.practicedCount / a.sentenceCount : 0
      const pB = b.sentenceCount ? b.practicedCount / b.sentenceCount : 0
      return pB - pA
    }
    if (sort === 'duration') {
      return (b.durationSeconds ?? 0) - (a.durationSeconds ?? 0)
    }
    if (sort === 'az') {
      return a.title.localeCompare(b.title, 'vi')
    }
    const tA = a.lastStudiedAt ?? a.addedAt
    const tB = b.lastStudiedAt ?? b.addedAt
    return tB.localeCompare(tA)
  })
}

export function formatDuration(seconds: number | null): string | null {
  if (!seconds) return null
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
