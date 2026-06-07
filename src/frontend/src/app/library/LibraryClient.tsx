'use client'

import { ImportBar } from '@/components/ImportBar'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { VideoRow } from './page'

interface Props {
  initialVideos: VideoRow[]
  apiBase: string
}

const statusBadge: Record<string, { label: string; className: string }> = {
  queued:     { label: 'Queued',     className: 'bg-yellow-100 text-yellow-800' },
  processing: { label: 'Processing', className: 'bg-blue-100 text-blue-800' },
  ready:      { label: 'Ready',      className: 'bg-green-100 text-green-800' },
  failed:     { label: 'Failed',     className: 'bg-red-100 text-red-800' },
}

function formatDuration(seconds: number | null) {
  if (!seconds) return null
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function LibraryClient({ initialVideos, apiBase }: Props) {
  const [videos, setVideos] = useState<VideoRow[]>(initialVideos)
  const router = useRouter()

  function handleImported(videoId: string) {
    router.refresh()
    // Optimistically mark card as ready if it exists, else refresh brings it in
    setVideos((prev) =>
      prev.map((v) =>
        v.id === videoId ? { ...v, transcript_status: 'ready' } : v
      )
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Library</h1>

      <div className="mb-8">
        <ImportBar apiBase={apiBase} onImported={handleImported} />
      </div>

      {videos.length === 0 ? (
        <p className="text-center text-gray-500">
          No videos yet — paste a YouTube link above to get started.
        </p>
      ) : (
        <ul className="space-y-3">
          {videos.map((video) => {
            const badge = statusBadge[video.transcript_status] ?? statusBadge.queued
            return (
              <li
                key={video.id}
                onClick={() => video.transcript_status === 'ready' && router.push(`/practice/${video.id}`)}
                className={`flex items-center gap-4 rounded-lg border border-gray-200 p-3 ${video.transcript_status === 'ready' ? 'cursor-pointer hover:bg-gray-50' : ''}`}
              >
                {video.thumbnail_url && (
                  <img
                    src={video.thumbnail_url}
                    alt=""
                    width={80}
                    height={45}
                    className="rounded object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{video.title}</p>
                  <p className="text-sm text-gray-500">
                    {formatDuration(video.duration_seconds)}
                    {video.transcript_status === 'ready' && ` · ${video.sentence_count} sentences`}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                  {badge.label}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
