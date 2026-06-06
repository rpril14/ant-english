import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LibraryClient } from './LibraryClient'

export default async function LibraryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: videos } = await supabase
    .from('user_videos')
    .select(`
      video_id,
      videos (
        id, title, thumbnail_url, duration_seconds,
        transcript_status, sentence_count, created_at
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { foreignTable: 'videos', ascending: false })

  const items = (videos ?? [])
    .map((row) => (row.videos as unknown as VideoRow | null))
    .filter(Boolean) as VideoRow[]

  return <LibraryClient initialVideos={items} apiBase={process.env.NEXT_PUBLIC_API_BASE ?? ''} />
}

export interface VideoRow {
  id: string
  title: string
  thumbnail_url: string | null
  duration_seconds: number | null
  transcript_status: string
  sentence_count: number
  created_at: string
}
