'use client'

import { ImportBar } from '@/components/ImportBar'
import {
  deriveCardState,
  applyFilter,
  applySort,
  formatDuration,
  type LibraryVideo,
  type FilterId,
  type SortId,
  type CardState,
} from '@/lib/library'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface Props {
  initialVideos: LibraryVideo[]
  apiBase: string
}

// ── design tokens ─────────────────────────────────────────────────────────────

const T = {
  bg:        '#F1EFE8',
  bg2:       '#E9E7DE',
  surface:   '#FBFAF6',
  surface2:  '#F3F1EA',
  surface3:  '#ECEAE1',
  line:      '#D3D1C7',
  lineSoft:  '#E1DFD5',
  text:      '#2C2C2A',
  text2:     '#56554F',
  text3:     '#84837B',
  text4:     '#A6A59C',
  ink:       '#2C2C2A',
  paper:     '#F6F4ED',
  teal:      '#1D9E75',
  tealDim:   'rgba(29,158,117,0.13)',
  coral:     '#D85A30',
  coralDim:  'rgba(216,90,48,0.12)',
  purple:    '#7F77DD',
  purpleDim: 'rgba(127,119,221,0.15)',
  shadow:    '0 1px 2px rgba(44,44,42,0.05), 0 6px 20px rgba(44,44,42,0.06)',
  shadowLg:  '0 2px 6px rgba(44,44,42,0.07), 0 18px 44px rgba(44,44,42,0.12)',
}

const STATE_META: Record<CardState, { label: string; color: string; dim: string }> = {
  processing: { label: 'Processing',  color: T.coral,  dim: T.coralDim },
  failed:     { label: 'Failed',      color: '#C0392B', dim: 'rgba(192,57,43,0.12)' },
  ready:      { label: 'Not started', color: T.text3,   dim: `color-mix(in srgb, ${T.text3} 14%, transparent)` },
  learning:   { label: 'Learning',    color: T.teal,    dim: T.tealDim },
  done:       { label: 'Done',        color: T.teal,    dim: T.tealDim },
}

// ── thumbnail pastel tints (derived from videoId hash) ────────────────────────

const TINTS: [string, string][] = [
  ['oklch(0.95 0.03 165)', 'oklch(0.90 0.045 175)'],
  ['oklch(0.95 0.03 290)', 'oklch(0.90 0.045 280)'],
  ['oklch(0.95 0.035 135)', 'oklch(0.90 0.05 145)'],
  ['oklch(0.95 0.03 15)', 'oklch(0.91 0.045 25)'],
  ['oklch(0.95 0.035 60)', 'oklch(0.91 0.05 55)'],
  ['oklch(0.95 0.03 235)', 'oklch(0.90 0.05 245)'],
]

function getTint(id: string): [string, string] {
  const h = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return TINTS[h % TINTS.length]
}

// ── svg icons ─────────────────────────────────────────────────────────────────

function Icon({ name, size = 18, fillCurrent = false }: { name: string; size?: number; fillCurrent?: boolean }) {
  const paths: Record<string, React.ReactNode> = {
    search:    <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    play:      <path d="M7 5.5v13l11-6.5z" fill="currentColor" stroke="none" />,
    heart:     <path d="M12 20s-7-4.5-9.5-9C1 8 2.5 4.5 6 4.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.5 6.5C19 15.5 12 20 12 20z" fill={fillCurrent ? 'currentColor' : 'none'} />,
    bookmark:  <path d="M6 4h12v16l-6-4-6 4z" />,
    more:      <><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/></>,
    check:     <path d="M5 12.5l4.5 4.5L19 7" strokeWidth="2.6" />,
    plus:      <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    chevron:   <path d="m6 9 6 6 6-6" />,
    layers:    <><path d="M12 3 3 8l9 5 9-5-9-5z" /><path d="m3 13 9 5 9-5" /></>,
    trophy:    <><path d="M7 4h10v4a5 5 0 0 1-10 0V4z" /><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3" /><path d="M12 13v4M9 21h6M10 21v-2h4v2" /></>,
    book:      <><path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 0-2 2V4z"/><path d="M5 18h13"/></>,
    flame:     <path d="M12 3c1 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1 .3-1.8.8-2.5C8 9.5 7 10.5 7 12.5a5 5 0 0 0 10 0C17 8 14 5.5 12 3z" />,
    sparkles:  <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3zM18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14z" fill="currentColor" stroke="none" />,
    list:      <><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1" fill="currentColor" stroke="none"/></>,
    rotate:    <><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" /></>,
    x:         <><path d="M6 6l12 12M18 6 6 18" /></>,
    clock:     <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
    headphones:<><path d="M4 13v-1a8 8 0 0 1 16 0v1"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/></>,
    youtube:   <><rect x="3" y="6" width="18" height="12" rx="3.5"/><path d="M10.5 9.5v5l4-2.5z" fill="currentColor" stroke="none"/></>,
  }
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {paths[name] ?? null}
    </svg>
  )
}

// ── sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, unit, accent, delay }: {
  icon: string; label: string; value: string | number; unit?: string; accent: string; delay: number
}) {
  return (
    <div
      className="lib-stat"
      style={{
        background: `linear-gradient(180deg, rgba(255,255,255,0.02), transparent), ${T.surface}`,
        border: `1px solid ${T.lineSoft}`,
        borderRadius: 16,
        padding: '18px 20px 20px',
        animationDelay: `${delay}ms`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: T.text3, fontWeight: 500 }}>{label}</span>
        <span style={{
          width: 28, height: 28, borderRadius: 9, display: 'grid', placeItems: 'center',
          color: accent, background: `color-mix(in srgb, ${accent} 14%, transparent)`,
        }}>
          <Icon name={icon} size={15} />
        </span>
      </div>
      <div style={{
        fontFamily: 'var(--font-newsreader, Georgia, serif)',
        fontSize: 38, fontWeight: 500, lineHeight: 1, letterSpacing: '-0.01em',
        color: T.text,
      }}>
        {value}{unit && <span style={{ fontFamily: 'var(--font-be-vietnam-pro, system-ui)', fontSize: 15, fontWeight: 500, color: T.text3, marginLeft: 4 }}>{unit}</span>}
      </div>
    </div>
  )
}

function StatusBadge({ state }: { state: CardState }) {
  const m = STATE_META[state]
  const isDone = state === 'done'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 12, fontWeight: 500,
      padding: '4px 10px', borderRadius: 8,
      color: isDone ? T.paper : m.color,
      background: isDone ? T.teal : m.dim,
      boxShadow: isDone ? '0 2px 6px rgba(29,158,117,0.28)' : undefined,
    }}>
      {isDone && <Icon name="check" size={13} />}
      {state === 'processing' && (
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.color, display: 'inline-block', animation: 'lib-pulse 1.2s ease-in-out infinite' }} />
      )}
      {m.label}
    </span>
  )
}

function ProgressBar({ practiced, total, color }: { practiced: number; total: number; color: string }) {
  const pct = total ? Math.round((practiced / total) * 100) : 0
  return (
    <div style={{ height: 5, borderRadius: 5, background: T.surface3, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, borderRadius: 5, background: color, transition: 'width 0.5s cubic-bezier(.2,.7,.2,1)' }} />
    </div>
  )
}

function SortMenu({ value, onChange }: { value: SortId; onChange: (v: SortId) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const OPTIONS: { id: SortId; label: string }[] = [
    { id: 'recent',   label: 'Recently Added' },
    { id: 'progress', label: 'Most Progress' },
    { id: 'duration', label: 'Duration' },
    { id: 'az',       label: 'Title A–Z' },
  ]
  const current = OPTIONS.find(o => o.id === value) ?? OPTIONS[0]

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 9,
          height: 52, padding: '0 14px 0 16px',
          borderRadius: 14,
          background: T.surface,
          border: `1px solid ${open ? `color-mix(in srgb, ${T.teal} 50%, transparent)` : T.lineSoft}`,
          color: T.text2,
          fontFamily: 'inherit', fontSize: 14, fontWeight: 500,
          cursor: 'pointer',
          boxShadow: open ? `0 0 0 4px ${T.tealDim}` : undefined,
          transition: 'all 0.16s',
          whiteSpace: 'nowrap',
        }}
      >
        <Icon name="list" size={16} />
        <span style={{ color: T.text }}>
          <span style={{ color: T.text3, fontWeight: 400 }}>Sort: </span>
          {current.label}
        </span>
        <span style={{ display: 'grid', placeItems: 'center', transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }}>
          <Icon name="chevron" size={15} />
        </span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 30,
          minWidth: 220,
          padding: 6,
          background: T.surface,
          border: `1px solid ${T.line}`,
          borderRadius: 14,
          boxShadow: T.shadowLg,
          display: 'flex', flexDirection: 'column', gap: 2,
          animation: 'lib-pop 0.16s cubic-bezier(.2,.7,.2,1) both',
          transformOrigin: 'top right',
        }}>
          {OPTIONS.map(o => (
            <button
              key={o.id}
              onClick={() => { onChange(o.id); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                width: '100%', height: 40, padding: '0 12px',
                border: 'none', borderRadius: 10,
                background: o.id === value ? T.tealDim : 'transparent',
                fontFamily: 'inherit', fontSize: 14,
                color: o.id === value ? T.teal : T.text2,
                fontWeight: o.id === value ? 500 : 400,
                textAlign: 'left', cursor: 'pointer',
                transition: 'background 0.12s, color 0.12s',
              }}
              className="lib-sort-item"
            >
              <span>{o.label}</span>
              {o.id === value && <Icon name="check" size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function VideoCard({ video, onFav, onPlay, onSave, onRemove, index }: {
  video: LibraryVideo
  onFav: (id: string) => void
  onPlay: (id: string) => void
  onSave: (id: string) => void
  onRemove: (id: string) => void
  index: number
}) {
  const state = deriveCardState(video)
  const processing = state === 'processing'
  const done = state === 'done'
  const dur = formatDuration(video.durationSeconds)
  const [a, b] = getTint(video.videoId)

  return (
    <article
      className="lib-card"
      style={{
        background: T.surface,
        border: `1px solid ${T.lineSoft}`,
        borderRadius: 16,
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        animationDelay: `${30 + index * 55}ms`,
      }}
    >
      {/* thumbnail */}
      <div
        style={{
          position: 'relative', aspectRatio: '16 / 9',
          cursor: processing ? 'default' : 'pointer',
          overflow: 'hidden',
          display: 'grid', placeItems: 'center',
          background: `linear-gradient(150deg, ${a}, ${b})`,
        }}
        onClick={() => !processing && onPlay(video.videoId)}
      >
        {video.thumbnailUrl && (
          <img
            src={video.thumbnailUrl} alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        {/* grain + light overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(120% 120% at 80% 10%, rgba(255,255,255,0.25), transparent 50%), radial-gradient(100% 100% at 10% 90%, rgba(0,0,0,0.06), transparent 55%)',
          mixBlendMode: 'overlay',
        }} />

        {processing ? (
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', border: `3px solid ${T.coralDim}`, borderTopColor: T.coral, animation: 'lib-spin 0.8s linear infinite' }} />
          </div>
        ) : (
          <button
            className="lib-play-btn"
            aria-label="Practice"
            style={{
              position: 'relative', zIndex: 1,
              width: 56, height: 56, borderRadius: '50%',
              border: 'none', cursor: 'pointer',
              display: 'grid', placeItems: 'center',
              background: 'rgba(34,34,42,0.86)',
              color: 'white',
              backdropFilter: 'blur(4px)',
              boxShadow: '0 8px 22px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.12)',
              transition: 'transform 0.18s, background 0.18s',
            }}
          >
            <Icon name="play" size={22} />
          </button>
        )}

        {dur && (
          <span style={{
            position: 'absolute', bottom: 11, right: 11, zIndex: 1,
            fontSize: 12, fontWeight: 600,
            color: 'white',
            background: 'rgba(28,28,38,0.82)',
            padding: '3px 8px', borderRadius: 7,
          }}>{dur}</span>
        )}
      </div>

      {/* body */}
      <div style={{ padding: '15px 16px 16px', display: 'flex', flexDirection: 'column', gap: 11, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <StatusBadge state={state} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => onFav(video.videoId)}
              aria-label={video.isFavorited ? 'Remove from favorites' : 'Add to favorites'}
              className="lib-icon-btn"
              style={{
                width: 32, height: 32, borderRadius: 9,
                display: 'grid', placeItems: 'center',
                border: `1px solid ${video.isFavorited ? 'transparent' : T.lineSoft}`,
                background: video.isFavorited ? `color-mix(in srgb, ${T.coral} 14%, transparent)` : 'transparent',
                color: video.isFavorited ? T.coral : T.text3,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <Icon name="heart" size={17} fillCurrent={video.isFavorited} />
            </button>
            <button
              onClick={() => onRemove(video.videoId)}
              aria-label="Remove from library"
              className="lib-icon-btn"
              style={{
                width: 32, height: 32, borderRadius: 9,
                display: 'grid', placeItems: 'center',
                border: `1px solid ${T.lineSoft}`,
                background: 'transparent',
                color: T.text3,
                cursor: 'pointer', transition: 'all 0.15s',
                fontSize: 16,
              }}
            >
              <Icon name="x" size={15} />
            </button>
          </div>
        </div>

        <h3 style={{
          margin: 0, fontSize: 15, fontWeight: 500, lineHeight: 1.34,
          letterSpacing: '-0.01em', color: T.text,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{video.title}</h3>

        <p style={{ margin: 0, fontSize: 13, color: T.text2, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', lineHeight: 1.3 }}>
          {processing ? (
            <span style={{ color: T.text3 }}>Processing…</span>
          ) : (
            <>
              <span>{video.sentenceCount} sentences</span>
              <span style={{ color: T.text4 }}>·</span>
              <span style={{ color: T.text3 }}>{video.lastStudiedAt ? `Studied ${relativeTime(video.lastStudiedAt)}` : `Added ${relativeTime(video.addedAt)}`}</span>
            </>
          )}
        </p>

        {processing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ height: 5, borderRadius: 5, background: T.surface3, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: '40%', borderRadius: 5,
                background: `linear-gradient(90deg, transparent, ${T.coral}, transparent)`,
                backgroundSize: '200% 100%',
                animation: 'lib-shimmer 1.4s linear infinite',
              }} />
            </div>
            <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: T.coral }}>
              <Icon name="sparkles" size={14} /> Whisper is running…
            </p>
          </div>
        ) : (
          <>
            <ProgressBar practiced={video.practicedCount} total={video.sentenceCount} color={done ? T.teal : T.teal} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 12.5, fontWeight: 600,
                color: done ? T.teal : T.text2,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {done && <Icon name="check" size={13} />}
                {video.practicedCount} / {video.sentenceCount} sentences
              </span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {video.customTags.map(tag => (
                  <span key={tag} style={{ fontSize: 11.5, fontWeight: 600, color: T.text3, background: T.bg2, border: `1px solid ${T.lineSoft}`, padding: '2px 9px', borderRadius: 7 }}>{tag}</span>
                ))}
              </div>
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 3 }}>
          {processing ? (
            <button disabled style={{
              flex: 1, height: 42, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              fontSize: 13.5, fontWeight: 500, borderRadius: 11,
              border: `1px solid ${T.lineSoft}`, background: T.surface2, color: T.text3, cursor: 'default',
              fontFamily: 'inherit',
            }}>
              <Icon name="clock" size={15} /> Processing…
            </button>
          ) : (
            <>
              <button
                onClick={() => onPlay(video.videoId)}
                className="lib-btn-primary"
                style={{
                  flex: 1, height: 42, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  fontSize: 13.5, fontWeight: 500, borderRadius: 11,
                  border: 'none', background: T.ink, color: T.paper,
                  cursor: 'pointer',
                  boxShadow: '0 3px 10px rgba(44,44,42,0.18)',
                  transition: 'all 0.15s', fontFamily: 'inherit',
                }}
              >
                {done ? <><Icon name="rotate" size={15} /> Review</> : <><Icon name="play" size={14} /> Continue</>}
              </button>
              <button
                onClick={() => onSave(video.videoId)}
                className="lib-btn-soft"
                style={{
                  flex: 1, height: 42, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  fontSize: 13.5, fontWeight: 500, borderRadius: 11,
                  border: `1px solid ${T.lineSoft}`, background: T.surface2, color: T.text,
                  cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                }}
              >
                <Icon name="bookmark" size={15} /> Saved
              </button>
              <button
                aria-label="More"
                className="lib-btn-square"
                style={{
                  width: 42, height: 42, flexShrink: 0,
                  display: 'grid', placeItems: 'center',
                  fontSize: 13.5, fontWeight: 500, borderRadius: 11,
                  border: `1px solid ${T.lineSoft}`, background: T.surface2, color: T.text3,
                  cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                }}
              >
                <Icon name="more" size={17} />
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  )
}

function AddCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="lib-add-card"
      style={{
        border: `1.5px dashed ${T.line}`,
        borderRadius: 16,
        background: 'transparent',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 9, padding: 30,
        cursor: 'pointer', color: T.text3,
        fontFamily: 'inherit',
        minHeight: 240,
        transition: 'all 0.18s ease',
        width: '100%',
      }}
    >
      <span className="lib-add-plus" style={{
        width: 52, height: 52, borderRadius: 15,
        display: 'grid', placeItems: 'center',
        background: T.surface2, color: T.text2,
        transition: 'all 0.18s',
      }}>
        <Icon name="plus" size={24} />
      </span>
      <span style={{ fontSize: 15, fontWeight: 500, color: T.text }}>Add new video</span>
      <span style={{ fontSize: 12.5 }}>Paste a YouTube link to get started</span>
    </button>
  )
}

// ── helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return `${Math.floor(d / 7)}w ago`
}

// ── main component ────────────────────────────────────────────────────────────

export function LibraryClient({ initialVideos, apiBase }: Props) {
  const [videos, setVideos] = useState<LibraryVideo[]>(initialVideos)

  useEffect(() => {
    setVideos(initialVideos)
  }, [initialVideos])

  const [filter, setFilter] = useState<FilterId>('all')
  const [sort, setSort] = useState<SortId>('recent')
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState<{ msg: string; id: number } | null>(null)
  const router = useRouter()
  const addBarRef = useRef<HTMLInputElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const counts = useMemo(() => ({
    all:      videos.length,
    learning: videos.filter(v => deriveCardState(v) === 'learning').length,
    done:     videos.filter(v => deriveCardState(v) === 'done').length,
    fav:      videos.filter(v => v.isFavorited).length,
  }), [videos])

  const totalPracticed = useMemo(() => videos.reduce((s, v) => s + v.practicedCount, 0), [videos])

  const visible = useMemo(() => {
    let list = applyFilter(videos, filter)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(v =>
        v.title.toLowerCase().includes(q) ||
        v.customTags.some(t => t.toLowerCase().includes(q))
      )
    }
    return applySort(list, sort)
  }, [videos, filter, sort, query])

  const showToast = useCallback((msg: string) => {
    clearTimeout(toastTimer.current)
    setToast({ msg, id: Date.now() })
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }, [])

  async function getToken() {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? ''
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  function handlePlay(videoId: string) {
    router.push(`/practice/${videoId}`)
  }

  function handleSave(_videoId: string) {
    router.push('/saved')
  }

  function handleImported() {
    router.refresh()
    showToast('Video added to your library')
  }

  async function handleFav(videoId: string) {
    setVideos(vs => vs.map(v => v.videoId === videoId ? { ...v, isFavorited: !v.isFavorited } : v))
    try {
      const token = await getToken()
      await fetch(`${apiBase}/api/library/${videoId}/favorite`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {
      setVideos(vs => vs.map(v => v.videoId === videoId ? { ...v, isFavorited: !v.isFavorited } : v))
      showToast('Could not save favorite — try again')
    }
  }

  async function handleRemove(videoId: string) {
    const removed = videos.find(v => v.videoId === videoId)
    if (!removed) return
    setVideos(vs => vs.filter(v => v.videoId !== videoId))
    showToast('Removed from library')
    try {
      const token = await getToken()
      const res = await fetch(`${apiBase}/api/library/${videoId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
    } catch {
      setVideos(vs => [removed, ...vs])
      showToast('Could not remove — try again')
    }
  }

  const FILTERS: { id: FilterId; label: string }[] = [
    { id: 'all',      label: 'All' },
    { id: 'learning', label: 'Learning' },
    { id: 'done',     label: 'Done' },
    { id: 'fav',      label: 'Favorites' },
  ]

  return (
    <>
      <style>{`
        @keyframes lib-spin    { to { transform: rotate(360deg); } }
        @keyframes lib-pulse   { 0%,100% { opacity:1; } 50% { opacity:0.35; } }
        @keyframes lib-shimmer { 0% { background-position:-200% 0; } 100% { background-position:200% 0; } }
        @keyframes lib-pop     { from { opacity:0; transform: scale(0.96); } to { opacity:1; transform: none; } }
        @keyframes lib-fadeUp  { from { opacity:0; transform: translateY(10px); } to { opacity:1; transform: none; } }
        @keyframes lib-toast   { from { opacity:0; transform: translateX(-50%) scale(0.96); } to { opacity:1; transform: translateX(-50%) scale(1); } }

        @media (prefers-reduced-motion: no-preference) {
          .lib-stat { animation: lib-fadeUp 0.5s cubic-bezier(.2,.7,.2,1) both; }
          .lib-card { animation: lib-fadeUp 0.5s cubic-bezier(.2,.7,.2,1) both; }
        }

        .lib-card {
          transition: transform 0.2s cubic-bezier(.2,.7,.2,1), border-color 0.2s, box-shadow 0.2s;
        }
        .lib-card:hover {
          transform: translateY(-4px);
          border-color: ${T.line} !important;
          box-shadow: ${T.shadowLg};
        }
        .lib-card:hover .lib-play-btn {
          transform: scale(1.08);
          background: ${T.ink} !important;
        }
        .lib-icon-btn:hover {
          color: ${T.text} !important;
          border-color: ${T.line} !important;
          background: ${T.surface2} !important;
        }
        .lib-btn-primary:hover { filter: brightness(1.15); transform: translateY(-1px); }
        .lib-btn-soft:hover    { background: ${T.surface3} !important; border-color: ${T.line} !important; }
        .lib-btn-square:hover  { background: ${T.surface3} !important; color: ${T.text} !important; border-color: ${T.line} !important; }
        .lib-add-card:hover {
          border-color: color-mix(in srgb, ${T.teal} 55%, transparent) !important;
          background: ${T.tealDim} !important;
          color: ${T.teal} !important;
        }
        .lib-add-card:hover .lib-add-plus {
          background: ${T.ink} !important;
          color: ${T.paper} !important;
          transform: scale(1.05);
        }
        .lib-sort-item:hover { background: ${T.surface2} !important; color: ${T.text} !important; }
        .lib-chip:hover { border-color: ${T.line} !important; color: ${T.text} !important; background: ${T.surface2} !important; }
        .lib-chip-on {
          background: ${T.tealDim} !important;
          border-color: color-mix(in srgb, ${T.teal} 45%, transparent) !important;
          color: ${T.teal} !important;
        }
        .lib-chip-on .lib-chip-count { background: color-mix(in srgb, ${T.teal} 22%, transparent) !important; color: ${T.teal} !important; }

        @media (max-width: 980px) {
          .lib-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .lib-stats { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 720px) {
          .lib-page { padding: 26px 18px 120px !important; }
          .lib-masthead-spacer { display: none !important; }
          .lib-filter-row { width: 100% !important; }
          .lib-grid { grid-template-columns: 1fr !important; }
          .lib-addbar { padding: 24px 18px 18px !important; }
        }
      `}</style>

      <div style={{
        minHeight: '100vh',
        background: `radial-gradient(1200px 600px at 12% -10%, rgba(29,158,117,0.05), transparent 60%), radial-gradient(1000px 600px at 96% 0%, rgba(216,90,48,0.045), transparent 55%), ${T.bg}`,
        backgroundAttachment: 'fixed',
        color: T.text,
        fontFamily: 'var(--font-be-vietnam-pro, system-ui, sans-serif)',
        WebkitFontSmoothing: 'antialiased',
      }}>
        <div className="lib-page" style={{ maxWidth: 1180, margin: '0 auto', padding: '38px 32px 140px' }}>

          {/* masthead */}
          <header style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 22, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
              <span style={{
                width: 44, height: 44, borderRadius: 13, display: 'grid', placeItems: 'center',
                background: T.ink, color: T.paper,
                boxShadow: '0 4px 12px rgba(44,44,42,0.22), inset 0 1px 0 rgba(255,255,255,0.08)',
              }}>
                <Icon name="headphones" size={19} />
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                <span style={{ fontWeight: 600, fontSize: 17, letterSpacing: '-0.01em' }}>Your Library</span>
                <span style={{ fontSize: 12.5, color: T.text3 }}>Practice listening &amp; speaking with real videos</span>
              </div>
            </div>
            <div className="lib-masthead-spacer" style={{ flex: '1 1 auto' }} />
            <div className="lib-filter-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                onClick={handleSignOut}
                className="lib-chip"
                style={{
                  display: 'inline-flex', alignItems: 'center', height: 38, padding: '0 14px',
                  borderRadius: 11, border: `1px solid ${T.lineSoft}`,
                  background: T.surface, color: T.text3,
                  fontFamily: 'inherit', fontSize: 13.5, fontWeight: 500, cursor: 'pointer',
                  transition: 'all 0.16s',
                }}
              >
                Sign out
              </button>
              {FILTERS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`lib-chip${filter === f.id ? ' lib-chip-on' : ''}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    height: 38, padding: '0 14px', borderRadius: 11,
                    border: `1px solid ${T.lineSoft}`,
                    background: T.surface, color: T.text2,
                    fontFamily: 'inherit', fontSize: 13.5, fontWeight: 500,
                    cursor: 'pointer', transition: 'all 0.16s',
                  }}
                >
                  {f.id === 'fav' && <Icon name="heart" size={14} fillCurrent={filter === 'fav'} />}
                  {f.label}
                  <span className="lib-chip-count" style={{ fontSize: 11.5, fontWeight: 600, color: T.text4, background: T.bg2, padding: '1px 7px', borderRadius: 20, minWidth: 20, textAlign: 'center' }}>
                    {counts[f.id]}
                  </span>
                </button>
              ))}
            </div>
          </header>

          {/* search + sort */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 26 }}>
            <label style={{
              flex: '1 1 auto', display: 'flex', alignItems: 'center', gap: 11,
              height: 52, padding: '0 16px', borderRadius: 14,
              background: T.surface, border: `1px solid ${T.lineSoft}`, color: T.text3,
            }}>
              <Icon name="search" size={18} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search videos, topics, sources…"
                style={{ flex: 1, border: 'none', background: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 15, color: T.text }}
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  style={{ width: 26, height: 26, borderRadius: 7, border: 'none', background: T.surface3, color: T.text2, cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                >
                  <Icon name="x" size={15} />
                </button>
              )}
            </label>
            <SortMenu value={sort} onChange={setSort} />
          </div>

          {/* stats */}
          <section className="lib-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 30 }}>
            <StatCard icon="layers"  label="Total Videos"       value={counts.all}     accent={T.text2}  delay={30}  />
            <StatCard icon="trophy"  label="Completed"          value={counts.done}    accent={T.purple} delay={80}  />
            <StatCard icon="book"    label="Sentences Practiced" value={totalPracticed} accent={T.coral}  delay={130} />
            <StatCard icon="flame"   label="Favorites"          value={counts.fav}     accent={T.teal}   delay={180} />
          </section>

          {/* grid */}
          {visible.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '70px 20px', textAlign: 'center' }}>
              <span style={{ width: 60, height: 60, borderRadius: 18, display: 'grid', placeItems: 'center', background: T.surface, border: `1px solid ${T.lineSoft}`, color: T.text3 }}>
                <Icon name="search" size={26} />
              </span>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 500 }}>No videos found</p>
              <p style={{ margin: '0 0 10px', fontSize: 14, color: T.text3 }}>Try a different keyword or change the filter.</p>
              <button
                onClick={() => { setQuery(''); setFilter('all') }}
                style={{ height: 42, padding: '0 18px', borderRadius: 11, border: `1px solid ${T.lineSoft}`, background: T.surface2, color: T.text, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 500, cursor: 'pointer' }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <section className="lib-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              {visible.map((v, i) => (
                <VideoCard key={v.videoId} video={v} index={i} onFav={handleFav} onPlay={handlePlay} onSave={handleSave} onRemove={handleRemove} />
              ))}
              {filter === 'all' && !query && <AddCard onClick={() => addBarRef.current?.focus()} />}
            </section>
          )}
        </div>
      </div>

      {/* fixed add bar */}
      <div
        className="lib-addbar"
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 20,
          background: `linear-gradient(180deg, transparent, ${T.bg} 38%)`,
          padding: '30px 32px 22px',
          pointerEvents: 'none',
        }}
      >
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', gap: 12, pointerEvents: 'auto' }}>
          <ImportBar apiBase={apiBase} onImported={handleImported} inputRef={addBarRef} />
        </div>
      </div>

      {/* toast */}
      {toast && (
        <div key={toast.id} style={{
          position: 'fixed', left: '50%', bottom: 100,
          zIndex: 40,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '13px 18px',
          background: T.surface3,
          border: `1px solid ${T.line}`,
          borderRadius: 13,
          fontSize: 14, fontWeight: 600, color: T.text,
          boxShadow: T.shadowLg,
          animation: 'lib-toast 0.3s cubic-bezier(.2,.7,.2,1) both',
          whiteSpace: 'nowrap',
        }}>
          <Icon name="check" size={16} />
          {toast.msg}
        </div>
      )}
    </>
  )
}
