'use client'

import { useVideoReady, type JobStatus } from '@/hooks/useVideoReady'
import { createClient } from '@/lib/supabase/client'
import { FormEvent, Ref, useState } from 'react'

interface Props {
  apiBase: string
  onImported: (videoId: string) => void
  /** Optional ref forwarded to the URL input, e.g. for programmatic focus. */
  inputRef?: Ref<HTMLInputElement>
}

const statusLabel: Record<JobStatus, string> = {
  queued: 'Đang xếp hàng…',
  processing: 'Đang xử lý…',
  ready: 'Hoàn thành!',
  failed: 'Thất bại — vui lòng thử lại',
}

const T = {
  surface2: 'oklch(0.248 0.009 265)',
  line:     'oklch(0.32 0.010 265)',
  text:     'oklch(0.97 0.004 265)',
  text4:    'oklch(0.50 0.008 265)',
  blue:     'oklch(0.66 0.155 255)',
  blueDim:  'oklch(0.66 0.155 255 / 0.14)',
  rose:     'oklch(0.68 0.18 18)',
  amber:    'oklch(0.78 0.14 75)',
}

/**
 * URL input bar — submits a YouTube link to POST /api/videos/import,
 * then tracks the job until it reaches a terminal state.
 */
export function ImportBar({ apiBase, onImported, inputRef }: Props) {
  const [url, setUrl] = useState('')
  const [jobId, setJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const jobStatus = useVideoReady(jobId, apiBase)
  const busy = submitting || jobStatus === 'queued' || jobStatus === 'processing'

  if (jobStatus === 'ready' && jobId) {
    onImported(jobId)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    try {
      const res = await fetch(`${apiBase}/api/videos/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ url }),
      })

      const body = await res.json()

      if (!res.ok) {
        setError(body.message ?? 'Something went wrong')
        return
      }

      if (body.status === 'ready') {
        onImported(body.videoId)
      } else {
        setJobId(body.jobId)
        setUrl('')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ width: '100%' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 12 }}>
        <label style={{
          flex: 1,
          display: 'flex', alignItems: 'center', gap: 12,
          height: 56, padding: '0 16px',
          borderRadius: 16,
          background: T.surface2,
          border: `1px solid ${T.line}`,
          boxShadow: '0 1px 2px oklch(0 0 0 / 0.4), 0 8px 24px oklch(0 0 0 / 0.28)',
          opacity: busy ? 0.6 : 1,
          transition: 'opacity 0.15s',
        }}>
          <span style={{ color: T.rose, display: 'grid', placeItems: 'center', fontSize: 20 }}>▶</span>
          <input
            ref={inputRef}
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !busy && handleSubmit(e as unknown as FormEvent)}
            placeholder="Dán link YouTube vào đây…"
            disabled={busy}
            required
            style={{ flex: 1, border: 'none', background: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 15, color: T.text, caretColor: T.blue }}
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          style={{
            height: 56, padding: '0 24px',
            background: busy ? `color-mix(in oklch, ${T.blue} 60%, transparent)` : T.blue,
            color: 'white',
            borderRadius: 16,
            border: 'none',
            fontFamily: 'inherit', fontSize: 14.5, fontWeight: 700,
            cursor: busy ? 'not-allowed' : 'pointer',
            boxShadow: busy ? 'none' : `0 1px 2px oklch(0 0 0 / 0.4), 0 6px 18px oklch(0.66 0.155 255 / 0.35)`,
            whiteSpace: 'nowrap',
            transition: 'all 0.15s',
          }}
        >
          ＋ Thêm vào library
        </button>
      </form>

      {jobStatus && jobStatus !== 'ready' && (
        <p style={{ marginTop: 8, fontSize: 13, color: jobStatus === 'failed' ? 'oklch(0.65 0.18 25)' : T.amber }}>
          {statusLabel[jobStatus]}
        </p>
      )}

      {error && <p style={{ marginTop: 8, fontSize: 13, color: 'oklch(0.65 0.18 25)' }}>{error}</p>}
    </div>
  )
}
