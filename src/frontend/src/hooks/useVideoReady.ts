'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useRef, useState } from 'react'

export type JobStatus = 'queued' | 'processing' | 'ready' | 'failed'

/**
 * Polls /api/jobs/{jobId}/status every 3 seconds until the job reaches a
 * terminal state (ready or failed). Also listens for Supabase DB changes on
 * the videos row so the UI updates without waiting for the next poll tick.
 */
export function useVideoReady(jobId: string | null, apiBase: string) {
  const [status, setStatus] = useState<JobStatus | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isTerminal = (s: JobStatus) => s === 'ready' || s === 'failed'

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  useEffect(() => {
    if (!jobId) return

    const supabase = createClient()

    const poll = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch(`${apiBase}/api/jobs/${jobId}/status`, {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
        })
        if (!res.ok) return
        const data: { jobId: string; status: JobStatus } = await res.json()
        setStatus(data.status)
        if (isTerminal(data.status)) stopPolling()
      } catch {
        // network error — keep polling
      }
    }

    poll()
    intervalRef.current = setInterval(poll, 3000)
    const channel = supabase
      .channel(`video:${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'videos',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          const newStatus = payload.new.transcript_status as JobStatus
          setStatus(newStatus)
          if (isTerminal(newStatus)) stopPolling()
        }
      )
      .subscribe()

    return () => {
      stopPolling()
      supabase.removeChannel(channel)
    }
  }, [jobId])

  return status
}
