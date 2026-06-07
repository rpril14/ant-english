'use client'

import { match, isComplete } from '@/lib/matching'
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

// ── Chip styling ──────────────────────────────────────────────────────────────

const CHIP_BG: Record<string, string> = {
  correct:   'bg-green-500 text-white',
  incorrect: 'bg-red-500 text-white',
  active:    'bg-yellow-400 text-gray-900',
  pending:   'bg-gray-700 text-gray-400',
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
  const [autoNext, setAutoNext] = useState(true)
  const [progress, setProgress] = useState<Record<string, ProgressRow>>(initialProgress)

  const playerRef = useRef<HTMLVideoElement>(null)
  // Prevent re-pausing after we've already paused for this sentence's end
  const hasPausedRef = useRef(false)

  const sentence = sentences[currentIdx]
  const result = sentence ? match(input, sentence.text, sentence.named_entities) : null

  // ── Seek to sentence start on mount and on sentence change ────────────────

  useEffect(() => {
    hasPausedRef.current = false
    if (playerRef.current && sentence) {
      playerRef.current.currentTime = sentence.start_time_ms / 1000
    }
  }, [currentIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── API ───────────────────────────────────────────────────────────────────

  const saveProgress = useCallback(async (sentenceId: string, score: number, completed: boolean) => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`${apiBase}/api/progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ sentenceId, score, hintLevelUsed: 0, completed }),
    })
    setProgress(prev => ({
      ...prev,
      [sentenceId]: {
        sentence_id: sentenceId,
        final_score: score,
        hint_level_used: 0,
        completed_at: completed ? new Date().toISOString() : prev[sentenceId]?.completed_at ?? null,
      },
    }))
  }, [apiBase])

  // ── Advance ───────────────────────────────────────────────────────────────

  const advance = useCallback(async (score: number, completed: boolean) => {
    if (!sentence) return
    await saveProgress(sentence.id, score, completed)

    const nextIdx = currentIdx + 1
    if (nextIdx < sentences.length) {
      setCurrentIdx(nextIdx)
      setInput('')
      hasPausedRef.current = false
      // Seek + play handled by the useEffect above + user pressing play,
      // but we also eagerly seek here so the player is positioned correctly
      if (playerRef.current) {
        playerRef.current.currentTime = sentences[nextIdx].start_time_ms / 1000
        playerRef.current.play()
      }
    }
  }, [sentence, currentIdx, sentences, saveProgress])

  // ── Auto-next on 95% (AC-102-4) ──────────────────────────────────────────

  useEffect(() => {
    if (!result || !sentence || !autoNext) return
    if (progress[sentence.id]?.completed_at) return
    if (isComplete(result)) {
      advance(result.score, true)
    }
  }, [result?.score, result?.chips.length]) // eslint-disable-line react-hooks/exhaustive-deps

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
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault()
        replay()
      }
      if (e.key === 'Enter' && document.activeElement?.tagName === 'INPUT') {
        e.preventDefault()
        if (result) advance(result.score, result.score >= 95)
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

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="truncate text-base font-semibold text-gray-100">{video.title}</h1>
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
          <span>Match: {result.score}%</span>
        </div>
      )}

      {/* Word chips */}
      <div className="flex flex-wrap gap-2 min-h-[2.75rem]">
        {result?.chips.map((chip, i) => (
          <span
            key={i}
            className={`rounded-lg px-3 py-1 text-sm font-medium tracking-wide transition-colors ${CHIP_BG[chip.status]}`}
          >
            {chip.status === 'pending' ? (
              DOT.repeat(chip.dotCount)
            ) : chip.status === 'active' ? (
              <>{chip.typed}<span className="opacity-50">{DOT.repeat(chip.dotCount)}</span></>
            ) : chip.status === 'incorrect' && chip.dotCount > 0 ? (
              // In-progress wrong: show typed + remaining dots
              <>{chip.typed}<span className="opacity-50">{DOT.repeat(chip.dotCount)}</span></>
            ) : (
              chip.display
            )}
          </span>
        ))}
        {sentenceCompleted && (
          <span className="self-center text-sm text-green-400">✓ Completed</span>
        )}
      </div>

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

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={replay}
          className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
          title="Ctrl+R"
        >
          Replay
        </button>

        <button
          onClick={() => result && advance(result.score, result.score >= 95)}
          disabled={!sentence || (isLast && sentenceCompleted)}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40"
        >
          {isLast && sentenceCompleted ? 'Done' : 'Next →'}
        </button>

        <label className="ml-auto flex items-center gap-2 text-sm text-gray-400 select-none cursor-pointer">
          <input
            type="checkbox"
            checked={autoNext}
            onChange={e => setAutoNext(e.target.checked)}
            className="h-4 w-4 rounded border-gray-600 bg-gray-700 accent-blue-500"
          />
          Auto Next
        </label>
      </div>
    </div>
  )
}
