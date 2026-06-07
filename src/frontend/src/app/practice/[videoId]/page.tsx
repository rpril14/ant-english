import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PracticeClient } from './PracticeClient'

interface Props {
  params: { videoId: string }
}

export default async function PracticePage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: video } = await supabase
    .from('videos')
    .select('id, title, youtube_id')
    .eq('id', params.videoId)
    .single()

  if (!video) redirect('/library')

  const { data: sentences } = await supabase
    .from('sentences')
    .select('id, index, text, translation, named_entities, start_time_ms, end_time_ms')
    .eq('video_id', params.videoId)
    .order('index')

  const sentenceList = sentences ?? []

  const { data: progressRows } = await supabase
    .from('user_progress')
    .select('sentence_id, final_score, hint_level_used, completed_at')
    .in('sentence_id', sentenceList.map(s => s.id))

  const initialProgress = Object.fromEntries(
    (progressRows ?? []).map(p => [p.sentence_id, p])
  )

  const firstIncomplete = sentenceList.findIndex(s => !initialProgress[s.id]?.completed_at)
  const initialIdx = firstIncomplete === -1 ? 0 : firstIncomplete

  return (
    <PracticeClient
      video={video}
      sentences={sentenceList}
      initialProgress={initialProgress}
      initialIdx={initialIdx}
      apiBase={process.env.NEXT_PUBLIC_API_BASE ?? ''}
    />
  )
}

export interface Sentence {
  id: string
  index: number
  text: string
  translation: string | null
  named_entities: string[]
  start_time_ms: number
  end_time_ms: number
}

export interface ProgressRow {
  sentence_id: string
  final_score: number | null
  hint_level_used: number
  completed_at: string | null
}
