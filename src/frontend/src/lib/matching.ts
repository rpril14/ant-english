/**
 * Word-by-word matching for the dictation practice UI.
 *
 * Status per chip:
 *   pending   – not yet reached (show dots)
 *   active    – currently being typed, prefix correct so far (yellow)
 *   incorrect – currently being typed but wrong letter, OR completed wrong (red)
 *   correct   – completed and matched (green)
 */

export type WordStatus = 'correct' | 'incorrect' | 'active' | 'pending'

export interface WordChip {
  /** Reference word in display form (original capitalisation, punctuation stripped) */
  display: string
  /** Normalised letters the user has typed for this slot */
  typed: string
  status: WordStatus
  /** Number of remaining-letter dots to render (for pending / active chips) */
  dotCount: number
}

export interface MatchResult {
  chips: WordChip[]
  correctCount: number
  totalCount: number
  /** 0-100, based on non-proper-noun words only */
  score: number
}

// ── internal helpers ──────────────────────────────────────────────────────────

function normaliseWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[''ʼ]/g, "'")
    .replace(/[^a-z0-9]/g, '')
}

/** Split text into display tokens: strip punctuation but keep capitalisation. */
function splitDisplay(text: string): string[] {
  return text
    .replace(/[''ʼ]/g, "'")
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

// ── public API ────────────────────────────────────────────────────────────────

/**
 * Compares the user's running input against a reference sentence.
 *
 * Trailing space in `input` treats the last word as completed;
 * no trailing space treats the last word as still being typed (active).
 */
export function match(input: string, reference: string, namedEntities: string[]): MatchResult {
  const displayWords = splitDisplay(reference)
  const normRef = displayWords.map(normaliseWord)

  const hasTrailingSpace = input.endsWith(' ')
  const parts = input.trim().split(/\s+/).filter(Boolean)
  const normInput = parts.map(normaliseWord)

  // How many words the user has "confirmed" by pressing space
  const completedCount = hasTrailingSpace ? parts.length : Math.max(0, parts.length - 1)
  const activeIdx = !hasTrailingSpace && parts.length > 0 ? parts.length - 1 : -1
  const activeTyped = activeIdx >= 0 ? normInput[activeIdx] : ''

  const namedSet = new Set(namedEntities.map(normaliseWord))

  const chips: WordChip[] = normRef.map((ref, i): WordChip => {
    const display = displayWords[i]

    if (i < completedCount) {
      // Confirmed word
      const typed = normInput[i] ?? ''
      return { display, typed, status: typed === ref ? 'correct' : 'incorrect', dotCount: 0 }
    }

    if (i === activeIdx) {
      // Word currently being typed
      if (activeTyped === ref) {
        // Fully and correctly typed (no space yet — treat as correct)
        return { display, typed: activeTyped, status: 'correct', dotCount: 0 }
      }
      if (ref.startsWith(activeTyped)) {
        // Correct prefix, more letters to go
        return { display, typed: activeTyped, status: 'active', dotCount: Math.max(0, ref.length - activeTyped.length) }
      }
      // Wrong letter
      return { display, typed: activeTyped, status: 'incorrect', dotCount: Math.max(0, ref.length - activeTyped.length) }
    }

    // Not yet reached
    return { display, typed: '', status: 'pending', dotCount: ref.length }
  })

  const scoreable = chips.filter(c => !namedSet.has(normaliseWord(c.display)))
  const correctScoreable = scoreable.filter(c => c.status === 'correct').length
  const score =
    scoreable.length === 0
      ? 100
      : Math.round((correctScoreable / scoreable.length) * 100)

  return {
    chips,
    correctCount: chips.filter(c => c.status === 'correct').length,
    totalCount: chips.length,
    score,
  }
}

/** True when all chips are resolved (no pending/active) and score ≥ threshold. */
export function isComplete(result: MatchResult, threshold = 95): boolean {
  return (
    result.chips.every(c => c.status !== 'pending' && c.status !== 'active') &&
    result.score >= threshold
  )
}

/**
 * Applies score cap based on hint level used.
 * Only hintLevel 3 (show all) triggers the 60% cap — levels 1 and 2 have no cap.
 */
export function applyScoreCap(score: number, hintLevel: number): number {
  return hintLevel >= 3 ? Math.min(score, 60) : score
}
