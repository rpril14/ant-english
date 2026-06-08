'use client'

import { match, isComplete, applyScoreCap } from '@/lib/matching'
import { deriveSidebar } from '@/lib/sidebar'
import { getTranslationVisible, setTranslationVisible } from '@/lib/prefs'
import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useRef, useState } from 'react'
import ReactPlayer from 'react-player'
import type { Sentence, ProgressRow } from './page'
import styles from './practice.module.css'

interface Props {
  video: { id: string; title: string; youtube_id: string }
  sentences: Sentence[]
  initialProgress: Record<string, ProgressRow>
  initialIdx: number
  initialSavedIds: string[]
  apiBase: string
}

// ── Small icon components ─────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  )
}

function ChevronLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
    </svg>
  )
}

function RotateIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" />
    </svg>
  )
}

function SparklesIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3zM18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14z" />
    </svg>
  )
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4h12v16l-6-4-6 4z" />
    </svg>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PracticeClient({
  video,
  sentences,
  initialProgress,
  initialIdx,
  initialSavedIds,
  apiBase,
}: Props) {
  const [currentIdx, setCurrentIdx] = useState(initialIdx)
  const [input, setInput] = useState('')
  const [progress, setProgress] = useState<Record<string, ProgressRow>>(initialProgress)
  const [chipsError, setChipsError] = useState(false)
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set(initialSavedIds))
  const [saveToast, setSaveToast] = useState<string | null>(null)
  const saveToastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const [showTranslation, setShowTranslation] = useState(true)

  useEffect(() => {
    setShowTranslation(getTranslationVisible())
  }, [])

  function toggleTranslation() {
    setShowTranslation(prev => {
      setTranslationVisible(!prev)
      return !prev
    })
  }

  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(new Set())
  const [firstLetterIndices, setFirstLetterIndices] = useState<Set<number>>(new Set())
  const [hintLevel, setHintLevel] = useState(0)

  const playerRef = useRef<HTMLVideoElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasPausedRef = useRef(false)
  const isInitialMount = useRef(true)

  const sentence = sentences[currentIdx]
  const result = sentence ? match(input, sentence.text, sentence.named_entities) : null

  // ── Reset hint/reveal state on sentence change ────────────────────────────

  useEffect(() => {
    hasPausedRef.current = false
    setRevealedIndices(new Set())
    setFirstLetterIndices(new Set())
    setHintLevel(0)
    if (isInitialMount.current) {
      isInitialMount.current = false
      if (playerRef.current && sentence) {
        playerRef.current.currentTime = sentence.start_time_ms / 1000
      }
    }
    if (sentence && progress[sentence.id]?.completed_at) {
      setInput(sentence.text)
    }
  }, [currentIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── API ───────────────────────────────────────────────────────────────────

  const saveProgress = useCallback(async (
    sentenceId: string, score: number, completed: boolean, usedHintLevel: number,
  ) => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`${apiBase}/api/progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ sentenceId, score, hintLevelUsed: usedHintLevel, completed }),
    })
    setProgress(prev => ({
      ...prev,
      [sentenceId]: {
        sentence_id: sentenceId,
        final_score: score,
        hint_level_used: usedHintLevel,
        completed_at: completed ? new Date().toISOString() : prev[sentenceId]?.completed_at ?? null,
      },
    }))
  }, [apiBase])

  // ── Advance ───────────────────────────────────────────────────────────────

  const advance = useCallback((score: number, completed: boolean) => {
    if (!sentence) return
    const nextIdx = currentIdx + 1
    if (nextIdx < sentences.length) {
      setCurrentIdx(nextIdx)
      setInput('')
      hasPausedRef.current = false
      if (playerRef.current) {
        playerRef.current.currentTime = sentences[nextIdx].start_time_ms / 1000
        playerRef.current.play()
      }
    }
    saveProgress(sentence.id, score, completed, hintLevel)
  }, [sentence, currentIdx, sentences, saveProgress, hintLevel])

  // ── Hint functions ────────────────────────────────────────────────────────

  function activateFirstLetter() {
    if (!result) return
    const idx = result.chips.findIndex(
      (c, i) => c.status === 'pending' && !firstLetterIndices.has(i) && !revealedIndices.has(i)
    )
    if (idx !== -1) {
      setFirstLetterIndices(prev => new Set(Array.from(prev).concat(idx)))
      setHintLevel(prev => Math.max(prev, 1))
    }
  }

  // ── Jump to sentence ──────────────────────────────────────────────────────

  const jumpTo = useCallback((idx: number) => {
    setCurrentIdx(idx)
    setInput('')
    hasPausedRef.current = false
    if (playerRef.current) {
      playerRef.current.currentTime = sentences[idx].start_time_ms / 1000
      playerRef.current.play()
    }
  }, [sentences])

  function revealChip(idx: number) {
    setRevealedIndices(prev => new Set(Array.from(prev).concat(idx)))
    setHintLevel(prev => Math.max(prev, 2))
  }

  // ── Auto-complete at 95% ──────────────────────────────────────────────────

  useEffect(() => {
    if (!result || !sentence) return
    if (progress[sentence.id]?.completed_at) return
    const effective = applyScoreCap(result.score, hintLevel)
    if (isComplete(result) && effective >= 95) {
      saveProgress(sentence.id, effective, true, hintLevel)
    }
  }, [result?.score, result?.chips.length, hintLevel]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Video: pause at sentence end ──────────────────────────────────────────

  function handleTimeUpdate(e: React.SyntheticEvent<HTMLVideoElement>) {
    if (!sentence || hasPausedRef.current) return
    const ms = e.currentTarget.currentTime * 1000
    if (ms >= sentence.end_time_ms) {
      hasPausedRef.current = true
      e.currentTarget.pause()
    }
  }

  function handlePlay() {
    if (!hasPausedRef.current || !playerRef.current || !sentence) return
    hasPausedRef.current = false
    playerRef.current.currentTime = sentence.start_time_ms / 1000
  }

  // ── Replay ────────────────────────────────────────────────────────────────

  const replay = useCallback(() => {
    if (!sentence || !playerRef.current) return
    hasPausedRef.current = false
    playerRef.current.currentTime = sentence.start_time_ms / 1000
    playerRef.current.play()
  }, [sentence])

  const toggleSave = useCallback(async (sentenceId: string) => {
    const isSaved = savedIds.has(sentenceId)
    setSavedIds(prev => {
      const next = new Set(prev)
      if (isSaved) next.delete(sentenceId)
      else next.add(sentenceId)
      return next
    })
    clearTimeout(saveToastTimer.current)
    setSaveToast(isSaved ? 'Sentence removed from saved list' : 'Sentence saved')
    saveToastTimer.current = setTimeout(() => setSaveToast(null), 2200)

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token ?? ''
    try {
      if (isSaved) {
        await fetch(`${apiBase}/api/saved/${sentenceId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
      } else {
        await fetch(`${apiBase}/api/saved`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(sentenceId),
        })
      }
    } catch {
      setSavedIds(prev => {
        const next = new Set(prev)
        if (isSaved) next.add(sentenceId)
        else next.delete(sentenceId)
        return next
      })
    }
  }, [savedIds, apiBase])

  const tryAdvance = useCallback(() => {
    const completed = sentence ? !!progress[sentence.id]?.completed_at : false
    if (!completed) {
      setChipsError(true)
      setTimeout(() => setChipsError(false), 600)
      return
    }
    const effective = result ? applyScoreCap(result.score, hintLevel) : 0
    advance(effective, true)
  }, [sentence, progress, result, hintLevel, advance])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'r') { e.preventDefault(); replay() }
      if (e.altKey && e.key === 'h')  { e.preventDefault(); activateFirstLetter() }
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); if (sentence) toggleSave(sentence.id) }
      if (e.key === 'Enter') { e.preventDefault(); tryAdvance() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [replay, tryAdvance, sentence]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 60)
  }, [currentIdx])

  // ── Render ────────────────────────────────────────────────────────────────

  if (sentences.length === 0) {
    return (
      <div className={styles.emptyState}>
        This video has no sentences yet.
      </div>
    )
  }

  const sentenceCompleted = sentence ? !!progress[sentence.id]?.completed_at : false
  const isLast = currentIdx === sentences.length - 1
  const effectiveScore = result ? applyScoreCap(result.score, hintLevel) : 0
  const typing = input.trim().length > 0 && !sentenceCompleted

  const sidebarItems = deriveSidebar(sentences, sentence?.id ?? '', progress)
  const completedCount = sidebarItems.filter(i => i.state === 'completed').length
  const pct = Math.round((completedCount / sentences.length) * 100)

  const isSaved = sentence ? savedIds.has(sentence.id) : false
  const hasFirstLetterHint = firstLetterIndices.size > 0

  return (
    <div className={styles.layout}>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className={styles.sidebar}>
        <div className={styles.sideHead}>
          <div className={styles.progressRow}>
            <span className={styles.progressLabel}>Progress</span>
            <span className={styles.progressNum}>
              <b>{completedCount}</b> / {sentences.length}
            </span>
          </div>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className={styles.sideList}>
          {sidebarItems.map((item, idx) => (
            <button
              key={item.id}
              onClick={() => jumpTo(idx)}
              className={[
                styles.sRow,
                item.state === 'current' ? styles.sRowCurrent : '',
                item.state === 'completed' ? styles.sRowDone : '',
              ].join(' ')}
            >
              <span className={styles.sRowIdx}>#{item.index + 1}</span>
              <span className={styles.sRowText}>
                {item.state === 'completed' ? (
                  item.text
                ) : (
                  item.text.trim().split(/\s+/).map((w, k) => (
                    <span key={k} className={styles.mask}>
                      {'*'.repeat(Math.max(2, w.replace(/[^a-zA-Z0-9]/g, '').length || 2))}
                    </span>
                  ))
                )}
              </span>
              {item.state === 'completed' && (
                <span className={styles.sRowCheck}><CheckIcon /></span>
              )}
            </button>
          ))}
        </div>
      </aside>

      {/* ── Practice area ───────────────────────────────────────────────── */}
      <main className={styles.main}>
        <div className={styles.mainInner}>

          {/* Header */}
          <header className={styles.practiceHead}>
            <a href="/library" className={styles.backLink}>
              <ChevronLeftIcon /> Library
            </a>
            <h1 className={styles.practiceTitle}>{video.title}</h1>
            <span className={styles.practiceCounter}>{currentIdx + 1} / {sentences.length}</span>
          </header>

          {/* Player */}
          <div className={styles.player}>
            <div className={styles.playerContainer}>
              <ReactPlayer
                ref={playerRef}
                src={`https://www.youtube.com/watch?v=${video.youtube_id}`}
                controls
                width="100%"
                height="100%"
                onTimeUpdate={handleTimeUpdate}
                onPlay={handlePlay}
              />
            </div>
          </div>

          {/* Stats row */}
          <div className={[styles.statsRow, (typing || sentenceCompleted) ? styles.statsRowVisible : ''].join(' ')}>
            {!sentenceCompleted && result && (
              <>
                <span><b>{result.correctCount}</b>/{result.totalCount} words</span>
                <span>
                  Match:{' '}
                  <b className={effectiveScore >= 95 ? styles.statMatchOk : ''}>
                    {effectiveScore}%
                  </b>
                </span>
                {hintLevel >= 3 && (
                  <span className={styles.statWarn}>Score capped at 60% — answer revealed</span>
                )}
              </>
            )}
          </div>

          {/* Word chips */}
          <div className={[styles.chips, chipsError ? styles.chipsFlash : ''].join(' ')}>
            {result?.chips.map((chip, i) => {
              const isRevealed = revealedIndices.has(i)
              if (chip.status === 'correct') {
                return (
                  <button key={i} className={[styles.chip, styles.chipCorrect].join(' ')} tabIndex={-1}>
                    {chip.display}
                  </button>
                )
              }
              if (chip.status === 'incorrect') {
                return (
                  <button
                    key={i}
                    className={[styles.chip, styles.chipWrong].join(' ')}
                    onClick={() => revealChip(i)}
                    tabIndex={-1}
                    title="Click to reveal"
                  >
                    {chip.typed}
                    {chip.dotCount > 0 && (
                      <span className={styles.chipDots} style={{ marginLeft: chip.typed ? '4px' : 0 }}>
                        {Array.from({ length: chip.dotCount }).map((_, k) => (
                          <span key={k} className={styles.dot} />
                        ))}
                      </span>
                    )}
                  </button>
                )
              }
              if (chip.status === 'active') {
                if (isRevealed) {
                  return (
                    <button key={i} className={[styles.chip, styles.chipRevealed].join(' ')} tabIndex={-1}>
                      {chip.display}
                    </button>
                  )
                }
                return (
                  <button key={i} className={[styles.chip, styles.chipActive].join(' ')} tabIndex={-1}>
                    {chip.typed}
                    {chip.dotCount > 0 && (
                      <span className={styles.chipDots} style={{ marginLeft: chip.typed ? '4px' : 0 }}>
                        {Array.from({ length: chip.dotCount }).map((_, k) => (
                          <span key={k} className={styles.dot} />
                        ))}
                      </span>
                    )}
                  </button>
                )
              }
              // pending — show revealed (purple) if the user clicked it, otherwise dashed dots
              if (isRevealed) {
                return (
                  <button key={i} className={[styles.chip, styles.chipRevealed].join(' ')} tabIndex={-1}>
                    {chip.display}
                  </button>
                )
              }
              const hasHint = firstLetterIndices.has(i)
              const dotCount = Math.max(0, chip.dotCount - (hasHint ? 1 : 0))
              return (
                <button
                  key={i}
                  className={[styles.chip, styles.chipPending].join(' ')}
                  onClick={() => revealChip(i)}
                  tabIndex={-1}
                  title="Click to reveal"
                >
                  <span className={styles.chipDots}>
                    {hasHint && (
                      <span className={styles.chipHintLetter}>{chip.display[0]}</span>
                    )}
                    {Array.from({ length: dotCount }).map((_, k) => (
                      <span key={k} className={styles.dot} />
                    ))}
                  </span>
                </button>
              )
            })}
            {sentenceCompleted && (
              <span className={styles.chipDone}>
                <CheckIcon /> Completed
              </span>
            )}
          </div>

          {/* Named entities */}
          {sentence?.named_entities && sentence.named_entities.length > 0 && (
            <div className={styles.entities}>
              <span className={styles.entitiesLabel}>Proper nouns:</span>
              {sentence.named_entities.map((name, i) => (
                <span key={i} className={styles.entity}>{name}</span>
              ))}
            </div>
          )}

          {/* Input */}
          <div className={styles.inputWrap}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={sentenceCompleted || !sentence}
              placeholder={sentenceCompleted ? 'Completed — press Next →' : 'Type what you hear…'}
              autoFocus
              ref={inputRef}
              className={[
                styles.typeInput,
                sentenceCompleted ? styles.typeInputComplete : '',
              ].join(' ')}
            />
          </div>

          {/* Translation — space reserved so toggling doesn't shift layout */}
          {sentenceCompleted && (
            <p
              className={styles.translation}
              style={{ visibility: showTranslation ? 'visible' : 'hidden' }}
            >
              {sentence?.translation ?? 'Translation not available'}
            </p>
          )}

          {/* Controls */}
          <div className={styles.controls}>
            <div className={styles.controlsLeft}>
              <button
                className={styles.ctl}
                onMouseDown={e => e.preventDefault()}
                onClick={replay}
                title="Replay (Ctrl + R)"
              >
                <RotateIcon /> Replay <kbd className={styles.ctlKbd}>⌃R</kbd>
              </button>

              <button
                className={[styles.ctl, hasFirstLetterHint ? styles.ctlGold : ''].join(' ')}
                onMouseDown={e => e.preventDefault()}
                onClick={activateFirstLetter}
                title="Reveal first letter (Alt + H)"
              >
                <SparklesIcon /> 1st letter <kbd className={styles.ctlKbd}>⌥H</kbd>
              </button>

              {sentence && (
                <button
                  className={[styles.ctl, isSaved ? styles.ctlSave : ''].join(' ')}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => toggleSave(sentence.id)}
                  title="Save sentence (Ctrl + S)"
                >
                  <BookmarkIcon filled={isSaved} />
                  {isSaved ? 'Saved' : 'Save'} <kbd className={styles.ctlKbd}>⌃S</kbd>
                </button>
              )}
            </div>

            <button
              className={[styles.ctl, styles.ctlPrimary].join(' ')}
              onMouseDown={e => e.preventDefault()}
              onClick={tryAdvance}
              title={isLast ? 'Finish (Enter)' : 'Next sentence (Enter)'}
            >
              {isLast ? 'Done' : 'Next'} <ArrowRightIcon />
              <kbd className={[styles.ctlKbd, styles.ctlPrimaryKbd].join(' ')}>↵</kbd>
            </button>
          </div>

          {/* Translation toggle — own row below controls */}
          <div className={styles.transRow}>
            <button
              className={[styles.ctl, styles.ctlGhost].join(' ')}
              onMouseDown={e => e.preventDefault()}
              onClick={toggleTranslation}
            >
              {showTranslation ? 'Hide translation' : 'Show translation'}
            </button>
          </div>

        </div>
      </main>

      {/* Toast */}
      {saveToast && (
        <div className={styles.toast} key={saveToast}>
          <BookmarkIcon filled={false} /> {saveToast}
        </div>
      )}
    </div>
  )
}
