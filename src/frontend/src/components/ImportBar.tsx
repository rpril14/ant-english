'use client'

import { useVideoReady, type JobStatus } from '@/hooks/useVideoReady'
import { createClient } from '@/lib/supabase/client'
import { FormEvent, useState } from 'react'

interface Props {
  apiBase: string
  onImported: (videoId: string) => void
}

const statusLabel: Record<JobStatus, string> = {
  queued: 'Queued…',
  processing: 'Processing…',
  ready: 'Ready!',
  failed: 'Failed — please try again',
}

/**
 * URL input bar that submits a YouTube link to POST /api/videos/import,
 * then tracks the job until it reaches a terminal state.
 */
export function ImportBar({ apiBase, onImported }: Props) {
  const [url, setUrl] = useState('')
  const [jobId, setJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const jobStatus = useVideoReady(jobId, apiBase)

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
    <div className="w-full">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a YouTube URL…"
          disabled={submitting || (jobStatus === 'queued' || jobStatus === 'processing')}
          required
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={submitting || jobStatus === 'queued' || jobStatus === 'processing'}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Import
        </button>
      </form>

      {jobStatus && jobStatus !== 'ready' && (
        <p className={`mt-2 text-sm ${jobStatus === 'failed' ? 'text-red-600' : 'text-gray-500'}`}>
          {statusLabel[jobStatus]}
        </p>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
