'use client'

import { match, isComplete, applyScoreCap } from '@/lib/matching'
import { deriveSidebar } from '@/lib/sidebar'
import { getTranslationVisible, setTranslationVisible } from '@/lib/prefs'
import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useRef, useState } from 'react'
import ReactPlayer from 'react-player'
import type { Sentence, ProgressRow } from './page'

interface Props {
  video: { id: string; title: string; youtube_id: string }
  sentences: Sentence[]
  initialProgress: Record<string, ProgressRow>
  initialIdx: number
  apiBase: string
}

const DOT = '·'

// ── Component ─────────────────────────────────────────────────────────────────

export function PracticeClient({
  video,
  sentences,
  initialProgress,
  initialIdx,
  apiBase,
}: Props) {
  const [currentIdx, setCurrentIdx] = useState(initialIdx)
  const [input, setInput] = useState('')
  const [progress, setProgress] = useState<Record<string, ProgressRow>>(initialProgress)

  // Hint state — resets on sentence change
  const [showTranslation, setShowTranslation] = useState(true)

  // Initialise from localStorage after mount (avoid SSR mismatch)
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
  const hasPausedRef = useRef(false)

  const sentence = sentences[currentIdx]
  const result = sentence ? match(input, sentence.text, sentence.named_entities) : null

  // ── Seek to sentence start on mount and on sentence change ────────────────

  useEffect(() => {
    hasPausedRef.current = false
    setRevealedIndices(new Set())
    setFirstLetterIndices(new Set())
    setHintLevel(0)
    if (playerRef.current && sentence) {
      playerRef.current.currentTime = sentence.start_time_ms / 1000
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

  const advance = useCallback(async (score: number, completed: boolean) => {
    if (!sentence) return
    await saveProgress(sentence.id, score, completed, hintLevel)

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
  }, [sentence, currentIdx, sentences, saveProgress, hintLevel])

  // ── Hint functions (AC-103-1, AC-103-2, AC-103-3) ────────────────────────

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

  // ── Jump to sentence (AC-108-2) ───────────────────────────────────────────

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

  // ── Auto-complete at 95% — mark done, show translation, wait for manual Next ──

  useEffect(() => {
    if (!result || !sentence) return
    if (progress[sentence.id]?.completed_at) return
    const effective = applyScoreCap(result.score, hintLevel)
    if (isComplete(result) && effective >= 95) {
      saveProgress(sentence.id, effective, true, hintLevel)
    }
  }, [result?.score, result?.chips.length, hintLevel]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Video: pause at sentence end (AC-102-1) ───────────────────────────────

  function handleTimeUpdate(e: React.SyntheticEvent<HTMLVideoElement>) {
    if (!sentence || hasPausedRef.current) return
    const ms = e.currentTarget.currentTime * 1000
    if (ms >= sentence.end_time_ms) {
      hasPausedRef.current = true
      e.currentTarget.pause()
    }
  }

  // ── Replay (AC-102-6) ─────────────────────────────────────────────────────

  const replay = useCallback(() => {
    if (!sentence || !playerRef.current) return
    hasPausedRef.current = false
    playerRef.current.currentTime = sentence.start_time_ms / 1000
    playerRef.current.play()
  }, [sentence])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'r') { e.preventDefault(); replay() }
      if (e.altKey && e.key === 'h')  { e.preventDefault(); activateFirstLetter() }
      if (e.key === 'Enter' && document.activeElement?.tagName === 'INPUT') {
        e.preventDefault()
        if (result) {
          const effective = applyScoreCap(result.score, hintLevel)
          advance(effective, effective >= 95)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [replay, result, advance])

  // ── Render ────────────────────────────────────────────────────────────────

  if (sentences.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-400">
        This video has no sentences yet.
      </div>
    )
  }

  const sentenceCompleted = sentence ? !!progress[sentence.id]?.completed_at : false
  const isLast = currentIdx === sentences.length - 1
  const effectiveScore = result ? applyScoreCap(result.score, hintLevel) : 0

  const sidebarItems = deriveSidebar(sentences, sentence?.id ?? '', progress)
  const completedCount = sidebarItems.filter(i => i.state === 'completed').length
  const pct = Math.round((completedCount / sentences.length) * 100)

  return (
    <div className="flex h-screen overflow-hidden bg-gray-900 text-gray-100">

      {/* ── Sidebar (AC-108-1, AC-108-3) ──────────────────────────────────── */}
      <aside className="w-80 shrink-0 border-r border-gray-700 flex flex-col">

        {/* Progress header (AC-108-3) */}
        <div className="p-4 border-b border-gray-700">
          <p className="text-sm font-medium text-gray-300">
            {completedCount} / {sentences.length}
          </p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-gray-700">
            <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Sentence list */}
        <div className="flex-1 overflow-y-auto">
          {sidebarItems.map((item, idx) => (
            <button
              key={item.id}
              onClick={() => jumpTo(idx)}
              className={`w-full flex items-start gap-2 px-3 py-2.5 text-left border-b border-gray-800 hover:bg-gray-800 transition-colors ${
                item.state === 'current' ? 'bg-gray-800' : ''
              }`}
            >
              <span className="shrink-0 mt-0.5 text-xs text-gray-500 w-6">#{item.index + 1}</span>
              {item.state === 'completed' ? (
                <span className="flex-1 text-xs text-gray-300 line-clamp-2">{item.text}</span>
              ) : (
                <span className="flex-1 text-xs text-gray-600 select-none tracking-wide">
                  {item.text.trim().split(/\s+/).map(w => '*'.repeat(w.replace(/[^a-zA-Z0-9]/g, '').length || 1)).join(' ')}
                </span>
              )}
              {item.state === 'completed' && (
                <span className="shrink-0 text-green-400 text-xs">✓</span>
              )}
            </button>
          ))}
        </div>
      </aside>

      {/* ── Practice area ──────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="truncate text-base font-semibold">{video.title}</h1>
        <span className="shrink-0 text-sm text-gray-400">
          {currentIdx + 1} / {sentences.length}
        </span>
      </div>

      {/* Player */}
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
        <ReactPlayer
          ref={playerRef}
          src={`https://www.youtube.com/watch?v=${video.youtube_id}`}
          controls
          width="100%"
          height="100%"
          onTimeUpdate={handleTimeUpdate}
        />
      </div>

      {/* Stats row */}
      {result && (
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <span>{result.correctCount}/{result.totalCount} words</span>
          <span>Match: <span className={effectiveScore >= 95 ? 'text-green-400 font-medium' : ''}>{effectiveScore}%</span></span>
          {hintLevel === 3 && (
            <span className="text-yellow-400">Score capped at 60% — answer revealed</span>
          )}
        </div>
      )}

      {/* Word chips */}
      <div className="flex flex-wrap gap-2 min-h-[2.75rem]">
        {result?.chips.map((chip, i) => {
          const isRevealed = revealedIndices.has(i) && chip.status === 'pending'

          if (chip.status === 'correct') {
            return <span key={i} className="rounded-lg px-3 py-1 text-sm font-medium bg-green-500 text-white">{chip.display}</span>
          }
          if (chip.status === 'incorrect' && chip.dotCount === 0) {
            return <span key={i} className="rounded-lg px-3 py-1 text-sm font-medium bg-red-500 text-white">{chip.display}</span>
          }
          if (chip.status === 'active' || (chip.status === 'incorrect' && chip.dotCount > 0)) {
            const bg = chip.status === 'active' ? 'bg-yellow-400 text-gray-900' : 'bg-red-500/40 text-red-300'
            return (
              <span key={i} className={`rounded-lg px-3 py-1 text-sm font-medium ${bg}`}>
                {chip.typed}<span className="opacity-40">{DOT.repeat(chip.dotCount)}</span>
              </span>
            )
          }
          // Pending
          if (isRevealed) {
            return <span key={i} className="rounded-lg px-3 py-1 text-sm font-medium bg-blue-500/40 text-blue-200">{chip.display}</span>
          }
          const hintText = firstLetterIndices.has(i) && chip.display.length > 0
            ? chip.display[0] + DOT.repeat(Math.max(0, chip.dotCount - 1))
            : DOT.repeat(chip.dotCount)
          return (
            <span
              key={i}
              onClick={() => revealChip(i)}
              className="rounded-lg px-3 py-1 text-sm font-medium bg-gray-700 text-gray-400 cursor-pointer hover:bg-gray-600 transition-colors select-none"
              title="Click to reveal"
            >
              {hintText}
            </span>
          )
        })}
        {sentenceCompleted && (
          <span className="self-center text-sm text-green-400">✓ Completed</span>
        )}
      </div>

      {/* Proper noun chips (AC-103-4) */}
      {sentence?.named_entities && sentence.named_entities.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sentence.named_entities.map((name, i) => (
            <span key={i} className="rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-300">
              {name}
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        disabled={sentenceCompleted || !sentence}
        placeholder={sentenceCompleted ? 'Completed — press Next →' : 'Type what you hear…'}
        autoFocus
        className="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 text-base text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none disabled:opacity-50"
      />

      {/* Translation (AC-104-1, AC-104-2, AC-104-3) */}
      {showTranslation && sentence && sentenceCompleted && (
        <p className="text-sm text-gray-500 italic">
          {sentence.translation ?? 'Translation not available'}
        </p>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={replay}
          className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
          title="Ctrl+R"
        >
          Replay
        </button>

        <button
          onClick={activateFirstLetter}
          className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
            firstLetterIndices.size > 0
              ? 'border-yellow-500/60 bg-yellow-500/10 text-yellow-400'
              : 'border-gray-600 text-gray-300 hover:bg-gray-700'
          }`}
          title="Alt+H"
        >
          1st letter
        </button>


        <button
          onClick={() => result && advance(effectiveScore, effectiveScore >= 95)}
          disabled={!sentence || (isLast && sentenceCompleted)}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40"
        >
          {isLast && sentenceCompleted ? 'Done' : 'Next →'}
        </button>

        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={toggleTranslation}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            {showTranslation ? 'Hide translation' : 'Show translation'}
          </button>

        </div>
      </div>
    </div>
    </main>
    </div>
  )
}
