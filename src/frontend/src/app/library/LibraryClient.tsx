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
import { useCallback, useMemo, useRef, useState } from 'react'

interface Props {
  initialVideos: LibraryVideo[]
  apiBase: string
}

// ── design tokens (dark theme) ───────────────────────────────────────────────

const T = {
  bg:       'oklch(0.165 0.006 265)',
  bg2:      'oklch(0.195 0.007 265)',
  surface:  'oklch(0.215 0.008 265)',
  surface2: 'oklch(0.248 0.009 265)',
  surface3: 'oklch(0.285 0.010 265)',
  line:     'oklch(0.32 0.010 265)',
  lineSoft: 'oklch(0.27 0.009 265)',
  text:     'oklch(0.97 0.004 265)',
  text2:    'oklch(0.78 0.006 265)',
  text3:    'oklch(0.62 0.008 265)',
  text4:    'oklch(0.50 0.008 265)',
  blue:     'oklch(0.66 0.155 255)',
  blueDim:  'oklch(0.66 0.155 255 / 0.14)',
  green:    'oklch(0.74 0.15 158)',
  greenDim: 'oklch(0.74 0.15 158 / 0.14)',
  amber:    'oklch(0.78 0.14 75)',
  amberDim: 'oklch(0.78 0.14 75 / 0.14)',
  rose:     'oklch(0.68 0.18 18)',
}

// ── card state metadata ──────────────────────────────────────────────────────

const STATE_META: Record<CardState, { label: string; color: string; dim: string }> = {
  processing: { label: 'Đang xử lý', color: T.amber, dim: T.amberDim },
  failed:     { label: 'Lỗi',        color: 'oklch(0.65 0.18 25)', dim: 'oklch(0.65 0.18 25 / 0.14)' },
  ready:      { label: 'Chưa học',   color: T.text3, dim: `color-mix(in oklch, ${T.text3} 14%, transparent)` },
  learning:   { label: 'Đang học',   color: T.blue,  dim: T.blueDim },
  done:       { label: 'Hoàn thành', color: T.green, dim: T.greenDim },
}

// ── sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon, label, value, unit, accent }: {
  icon: string; label: string; value: string | number; unit?: string; accent: string
}) {
  return (
    <div style={{
      background: `linear-gradient(180deg, oklch(1 0 0 / 0.02), transparent), ${T.surface}`,
      border: `1px solid ${T.lineSoft}`,
      borderRadius: 16,
      padding: '18px 20px 20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: T.text3, fontWeight: 500 }}>{label}</span>
        <span style={{
          width: 28, height: 28, borderRadius: 9, display: 'grid', placeItems: 'center',
          color: accent, background: `color-mix(in oklch, ${accent} 14%, transparent)`,
          fontSize: 15,
        }}>{icon}</span>
      </div>
      <div style={{ fontFamily: 'var(--font-geist-sans, system-ui)', fontSize: 36, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.02em', color: T.text }}>
        {value}{unit && <span style={{ fontSize: 15, fontWeight: 500, color: T.text3, marginLeft: 4 }}>{unit}</span>}
      </div>
    </div>
  )
}

function StatusBadge({ state }: { state: CardState }) {
  const m = STATE_META[state]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 12, fontWeight: 700,
      padding: '4px 10px', borderRadius: 8,
      color: m.color, background: m.dim,
    }}>
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

function VideoCard({ video, onFav, onPlay, onRemove }: {
  video: LibraryVideo
  onFav: (id: string) => void
  onPlay: (id: string) => void
  onRemove: (id: string) => void
}) {
  const state = deriveCardState(video)
  const processing = state === 'processing'
  const done = state === 'done'
  const dur = formatDuration(video.durationSeconds)

  return (
    <article style={{
      background: T.surface,
      border: `1px solid ${T.lineSoft}`,
      borderRadius: 16,
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      transition: 'transform 0.2s cubic-bezier(.2,.7,.2,1), border-color 0.2s, box-shadow 0.2s',
    }}
    className="lib-card"
    >
      {/* thumbnail */}
      <div
        style={{ position: 'relative', aspectRatio: '16 / 9', cursor: processing ? 'default' : 'pointer', overflow: 'hidden', display: 'grid', placeItems: 'center', background: T.surface2 }}
        onClick={() => !processing && onPlay(video.videoId)}
      >
        {video.thumbnailUrl ? (
          <img src={video.thumbnailUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(150deg, ${T.surface2}, ${T.surface3})` }} />
        )}
        {processing ? (
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', border: `3px solid ${T.amberDim}`, borderTopColor: T.amber, animation: 'lib-spin 0.8s linear infinite' }} />
          </div>
        ) : (
          <button
            className="lib-play-btn"
            aria-label="Luyện tập"
            style={{
              position: 'relative', zIndex: 1,
              width: 56, height: 56, borderRadius: '50%',
              border: 'none', cursor: 'pointer',
              display: 'grid', placeItems: 'center',
              background: 'oklch(0.22 0.01 265 / 0.86)',
              color: 'white',
              backdropFilter: 'blur(4px)',
              boxShadow: '0 8px 22px oklch(0 0 0 / 0.35), inset 0 0 0 1px oklch(1 0 0 / 0.12)',
              transition: 'transform 0.18s, background 0.18s',
              fontSize: 20,
            }}
          >▶</button>
        )}
        {dur && (
          <span style={{
            position: 'absolute', bottom: 11, right: 11, zIndex: 1,
            fontSize: 12, fontWeight: 600,
            color: 'white',
            background: 'oklch(0.18 0.01 265 / 0.82)',
            padding: '3px 8px', borderRadius: 7,
          }}>{dur}</span>
        )}
      </div>

      {/* body */}
      <div style={{ padding: '15px 16px 16px', display: 'flex', flexDirection: 'column', gap: 11, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <StatusBadge state={state} />
          <div style={{ display: 'flex', gap: 6 }}>
            {/* favourite */}
            <button
              onClick={() => onFav(video.videoId)}
              aria-label={video.isFavorited ? 'Bỏ yêu thích' : 'Yêu thích'}
              style={{
                width: 32, height: 32, borderRadius: 9,
                display: 'grid', placeItems: 'center',
                border: `1px solid ${video.isFavorited ? 'transparent' : T.lineSoft}`,
                background: video.isFavorited ? `color-mix(in oklch, ${T.rose} 14%, transparent)` : 'transparent',
                color: video.isFavorited ? T.rose : T.text3,
                cursor: 'pointer', transition: 'all 0.15s',
                fontSize: 15,
              }}
            >{video.isFavorited ? '♥' : '♡'}</button>
            {/* remove */}
            <button
              onClick={() => onRemove(video.videoId)}
              aria-label="Xoá khỏi thư viện"
              style={{
                width: 32, height: 32, borderRadius: 9,
                display: 'grid', placeItems: 'center',
                border: `1px solid ${T.lineSoft}`,
                background: 'transparent',
                color: T.text3,
                cursor: 'pointer', transition: 'all 0.15s',
                fontSize: 14,
              }}
            >×</button>
          </div>
        </div>

        <h3 style={{
          margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.34,
          letterSpacing: '-0.01em', color: T.text,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{video.title}</h3>

        <p style={{ margin: 0, fontSize: 13, color: T.text2, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', lineHeight: 1.3 }}>
          {processing ? (
            <span style={{ color: T.text3 }}>Đang xử lý…</span>
          ) : (
            <>
              <span>{video.sentenceCount} câu</span>
              <span style={{ color: T.text4 }}>·</span>
              <span style={{ color: T.text3 }}>{video.lastStudiedAt ? `Học ${relativeTime(video.lastStudiedAt)}` : `Thêm ${relativeTime(video.addedAt)}`}</span>
            </>
          )}
        </p>

        {!processing && (
          <>
            <ProgressBar
              practiced={video.practicedCount}
              total={video.sentenceCount}
              color={done ? T.green : T.blue}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: done ? T.green : T.text2, display: 'inline-flex', alignItems: 'center', gap: 5, fontVariantNumeric: 'tabular-nums' }}>
                {done && '✓ '}{video.practicedCount} / {video.sentenceCount} câu
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
            <button disabled style={{ flex: 1, height: 42, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 13.5, fontWeight: 600, borderRadius: 11, border: `1px solid ${T.lineSoft}`, background: T.surface2, color: T.text3, cursor: 'default' }}>
              ⏱ Chờ xử lý
            </button>
          ) : (
            <button
              onClick={() => onPlay(video.videoId)}
              style={{ flex: 1, height: 42, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 13.5, fontWeight: 600, borderRadius: 11, border: 'none', background: T.blue, color: 'white', cursor: 'pointer', boxShadow: `0 4px 12px color-mix(in oklch, ${T.blue} 30%, transparent)`, transition: 'all 0.15s' }}
            >
              {done ? '↺ Ôn lại' : '▶ Tiếp tục'}
            </button>
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
      <span style={{ width: 52, height: 52, borderRadius: 15, display: 'grid', placeItems: 'center', background: T.surface2, color: T.text2, fontSize: 24, transition: 'all 0.18s' }}>＋</span>
      <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Thêm video mới</span>
      <span style={{ fontSize: 12.5 }}>Dán link YouTube để bắt đầu</span>
    </button>
  )
}

// ── relative time (simple, no external lib) ──────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'vừa xong'
  if (m < 60) return `${m} phút trước`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} giờ trước`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} ngày trước`
  return `${Math.floor(d / 7)} tuần trước`
}

// ── main component ───────────────────────────────────────────────────────────

export function LibraryClient({ initialVideos, apiBase }: Props) {
  const [videos, setVideos] = useState<LibraryVideo[]>(initialVideos)
  const [filter, setFilter] = useState<FilterId>('all')
  const [sort, setSort] = useState<SortId>('recent')
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState<{ msg: string; id: number } | null>(null)
  const router = useRouter()
  const addBarRef = useRef<HTMLInputElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const counts = useMemo(() => ({
    all: videos.length,
    learning: videos.filter(v => deriveCardState(v) === 'learning').length,
    done: videos.filter(v => deriveCardState(v) === 'done').length,
    fav: videos.filter(v => v.isFavorited).length,
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

  function handleImported() {
    router.refresh()
    showToast('Video đã thêm vào thư viện')
  }

  async function handleFav(videoId: string) {
    // optimistic update
    setVideos(vs => vs.map(v => v.videoId === videoId ? { ...v, isFavorited: !v.isFavorited } : v))
    try {
      const token = await getToken()
      await fetch(`${apiBase}/api/library/${videoId}/favorite`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {
      // revert
      setVideos(vs => vs.map(v => v.videoId === videoId ? { ...v, isFavorited: !v.isFavorited } : v))
      showToast('Không thể lưu yêu thích — thử lại')
    }
  }

  async function handleRemove(videoId: string) {
    const removed = videos.find(v => v.videoId === videoId)
    if (!removed) return
    setVideos(vs => vs.filter(v => v.videoId !== videoId))
    showToast('Đã xoá khỏi thư viện')
    try {
      const token = await getToken()
      const res = await fetch(`${apiBase}/api/library/${videoId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
    } catch {
      setVideos(vs => [removed, ...vs])
      showToast('Không thể xoá — thử lại')
    }
  }

  const FILTERS: { id: FilterId; label: string }[] = [
    { id: 'all', label: 'Tất cả' },
    { id: 'learning', label: 'Đang học' },
    { id: 'done', label: 'Hoàn thành' },
    { id: 'fav', label: '♥ Yêu thích' },
  ]

  return (
    <>
      {/* keyframe animations injected via style tag */}
      <style>{`
        @keyframes lib-spin { to { transform: rotate(360deg); } }
        @keyframes lib-pulse { 0%,100% { opacity:1; } 50% { opacity:0.35; } }
        @keyframes lib-pop { from { opacity:0; transform: translateX(-50%) scale(0.96); } to { opacity:1; transform: translateX(-50%) scale(1); } }
        .lib-card:hover { transform: translateY(-4px); border-color: ${T.line} !important; box-shadow: 0 2px 4px oklch(0 0 0 / 0.4), 0 20px 50px oklch(0 0 0 / 0.45); }
        .lib-card:hover .lib-play-btn { background: ${T.blue} !important; transform: scale(1.08); }
        .lib-add-card:hover { border-color: color-mix(in oklch, ${T.blue} 55%, transparent) !important; background: ${T.blueDim} !important; color: ${T.blue} !important; }
        .lib-chip-on { background: ${T.blueDim} !important; border-color: color-mix(in oklch, ${T.blue} 45%, transparent) !important; color: ${T.blue} !important; }
      `}</style>

      <div style={{ minHeight: '100vh', background: `radial-gradient(1200px 600px at 15% -10%, oklch(0.66 0.155 255 / 0.07), transparent 60%), radial-gradient(1000px 600px at 95% 0%, oklch(0.74 0.15 158 / 0.05), transparent 55%), ${T.bg}`, color: T.text, fontFamily: 'system-ui, sans-serif', WebkitFontSmoothing: 'antialiased' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '38px 32px 140px' }}>

          {/* masthead */}
          <header style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 22, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
              <span style={{ width: 44, height: 44, borderRadius: 13, display: 'grid', placeItems: 'center', background: `linear-gradient(145deg, ${T.blue}, oklch(0.62 0.16 285))`, color: 'white', boxShadow: `0 6px 18px oklch(0.66 0.155 255 / 0.35), inset 0 1px 0 oklch(1 0 0 / 0.3)`, fontSize: 19 }}>🎧</span>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.01em' }}>Thư viện của bạn</span>
                <span style={{ fontSize: 12.5, color: T.text3 }}>Luyện nghe &amp; nói qua video thật</span>
              </div>
            </div>
            <div style={{ flex: '1 1 auto' }} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                onClick={handleSignOut}
                style={{
                  height: 38, padding: '0 14px',
                  borderRadius: 11,
                  border: `1px solid ${T.lineSoft}`,
                  background: 'transparent',
                  color: T.text3,
                  fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.16s ease',
                }}
              >
                Đăng xuất
              </button>
              {FILTERS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={filter === f.id ? 'lib-chip-on' : ''}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    height: 38, padding: '0 14px',
                    borderRadius: 11,
                    border: `1px solid ${T.lineSoft}`,
                    background: T.surface,
                    color: T.text2,
                    fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.16s ease',
                  }}
                >
                  {f.label}
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: T.text4, background: T.bg2, padding: '1px 7px', borderRadius: 20, minWidth: 20, textAlign: 'center' }}>
                    {counts[f.id]}
                  </span>
                </button>
              ))}
            </div>
          </header>

          {/* search + sort */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 26 }}>
            <label style={{ flex: '1 1 auto', display: 'flex', alignItems: 'center', gap: 11, height: 52, padding: '0 16px', borderRadius: 14, background: T.surface, border: `1px solid ${T.lineSoft}`, color: T.text3 }}>
              <span>🔍</span>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Tìm video, chủ đề…"
                style={{ flex: 1, border: 'none', background: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 15, color: T.text }}
              />
              {query && (
                <button onClick={() => setQuery('')} style={{ width: 26, height: 26, borderRadius: 7, border: 'none', background: T.surface3, color: T.text2, cursor: 'pointer', fontSize: 14 }}>×</button>
              )}
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 9, height: 52, padding: '0 14px', borderRadius: 14, background: T.surface, border: `1px solid ${T.lineSoft}`, color: T.text3 }}>
              <select
                value={sort}
                onChange={e => setSort(e.target.value as SortId)}
                style={{ appearance: 'none', border: 'none', background: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: T.text, cursor: 'pointer' }}
              >
                <option value="recent">Mới học nhất</option>
                <option value="progress">Tiến độ nhiều nhất</option>
              </select>
              <span style={{ pointerEvents: 'none', fontSize: 12 }}>▾</span>
            </div>
          </div>

          {/* stats */}
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 30 }}>
            <StatCard icon="📚" label="Tổng video"     value={counts.all}        accent={T.blue}  />
            <StatCard icon="🏆" label="Hoàn thành"     value={counts.done}       accent={T.green} />
            <StatCard icon="📖" label="Câu đã luyện"   value={totalPracticed}    accent={T.blue}  />
            <StatCard icon="♥"  label="Yêu thích"      value={counts.fav}        accent={T.rose}  />
          </section>

          {/* grid */}
          {visible.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '70px 20px', textAlign: 'center' }}>
              <span style={{ width: 60, height: 60, borderRadius: 18, display: 'grid', placeItems: 'center', background: T.surface, border: `1px solid ${T.lineSoft}`, color: T.text3, fontSize: 26 }}>🔍</span>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Không tìm thấy video nào</p>
              <p style={{ margin: '0 0 10px', fontSize: 14, color: T.text3 }}>Thử từ khoá khác hoặc đổi bộ lọc.</p>
              <button onClick={() => { setQuery(''); setFilter('all') }} style={{ height: 42, padding: '0 18px', borderRadius: 11, border: `1px solid ${T.lineSoft}`, background: T.surface2, color: T.text, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
                Xoá bộ lọc
              </button>
            </div>
          ) : (
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              {visible.map(v => (
                <VideoCard key={v.videoId} video={v} onFav={handleFav} onPlay={handlePlay} onRemove={handleRemove} />
              ))}
              {filter === 'all' && !query && <AddCard onClick={() => addBarRef.current?.focus()} />}
            </section>
          )}
        </div>
      </div>

      {/* fixed add bar */}
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 20, background: `linear-gradient(180deg, transparent, ${T.bg} 38%)`, padding: '30px 32px 22px', pointerEvents: 'none' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', gap: 12, pointerEvents: 'auto' }}>
          <ImportBar apiBase={apiBase} onImported={handleImported} inputRef={addBarRef} />
        </div>
      </div>

      {/* toast */}
      {toast && (
        <div key={toast.id} style={{
          position: 'fixed', left: '50%', bottom: 100, transform: 'translateX(-50%)',
          zIndex: 40,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '13px 18px',
          background: T.surface3,
          border: `1px solid ${T.line}`,
          borderRadius: 13,
          fontSize: 14, fontWeight: 600, color: T.text,
          boxShadow: '0 2px 4px oklch(0 0 0 / 0.4), 0 20px 50px oklch(0 0 0 / 0.45)',
          animation: 'lib-pop 0.3s cubic-bezier(.2,.7,.2,1) both',
          whiteSpace: 'nowrap',
        }}>
          {toast.msg}
        </div>
      )}
    </>
  )
}
