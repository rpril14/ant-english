'use client'

import { useVideoReady, type JobStatus } from '@/hooks/useVideoReady'
import { createClient } from '@/lib/supabase/client'
import { FormEvent, Ref, useEffect, useState } from 'react'

interface Props {
  apiBase: string
  onImported: (videoId: string) => void
  /** Optional ref forwarded to the URL input, e.g. for programmatic focus. */
  inputRef?: Ref<HTMLInputElement>
}

const statusLabel: Record<JobStatus, string> = {
  queued: 'Queued…',
  processing: 'Processing…',
  ready: 'Done!',
  failed: 'Failed — please try again',
}

const T = {
  surface2: '#F3F1EA',
  line:     '#D3D1C7',
  text:     '#2C2C2A',
  text4:    '#A6A59C',
  blue:     '#1D9E75',
  blueDim:  'rgba(29,158,117,0.13)',
  rose:     '#D85A30',
  amber:    '#D85A30',
  ink:      '#2C2C2A',
  paper:    '#F6F4ED',
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

  useEffect(() => {
    if (jobStatus === 'ready' && jobId) {
      setJobId(null)
      onImported(jobId)
    }
  }, [jobStatus]) // eslint-disable-line react-hooks/exhaustive-deps

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
          boxShadow: '0 1px 2px rgba(44,44,42,0.05), 0 6px 20px rgba(44,44,42,0.06)',
          opacity: busy ? 0.6 : 1,
          transition: 'opacity 0.15s',
        }}>
          <span style={{ color: T.rose, display: 'grid', placeItems: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="6" width="18" height="12" rx="3.5"/>
              <path d="M10.5 9.5v5l4-2.5z" fill="currentColor" stroke="none"/>
            </svg>
          </span>
          <input
            ref={inputRef}
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !busy && handleSubmit(e as unknown as FormEvent)}
            placeholder="Paste a YouTube link…"
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
            background: busy ? `color-mix(in srgb, ${T.ink} 60%, transparent)` : T.ink,
            color: T.paper,
            borderRadius: 16,
            border: 'none',
            fontFamily: 'inherit', fontSize: 14.5, fontWeight: 500,
            cursor: busy ? 'not-allowed' : 'pointer',
            boxShadow: busy ? 'none' : '0 1px 2px rgba(44,44,42,0.05), 0 4px 14px rgba(44,44,42,0.2)',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14"/><path d="M5 12h14"/>
          </svg>
          Add to library
        </button>
      </form>

      {jobStatus && jobStatus !== 'ready' && (
        <p style={{ marginTop: 8, fontSize: 13, color: jobStatus === 'failed' ? '#C0392B' : T.amber }}>
          {statusLabel[jobStatus]}
        </p>
      )}

      {error && <p style={{ marginTop: 8, fontSize: 13, color: '#C0392B' }}>{error}</p>}
    </div>
  )
}
